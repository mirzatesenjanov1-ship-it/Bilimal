const { calculateAttendanceStatus } = require('../services/attendanceEngine');
const nodemailer = require('nodemailer');

// SMTP Электрондук почта жөнөтүү тутуму
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: process.env.SMTP_PORT || 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER || 'notifications@bilimal.org',
        pass: process.env.SMTP_PASS || 'secret_password'
    }
});

// QR Сканерлөө аркылуу автоматтык каттоо (Check-in / Check-out)
const processQRCheck = async (req, res) => {
    try {
        const { qrToken } = req.body;
        const today = new Date().toISOString().split('T')[0];
        const currentTime = new Date().toTimeString().split(' ')[0];

        // 1. Окуучуну QR токен аркылуу табуу
        const student = await req.db.query('SELECT * FROM students WHERE qr_token = $1', [qrToken]);
        if (student.rows.length === 0) {
            return res.status(404).json({ success: false, message: 'Жараксыз QR-код!' });
        }

        const studentData = student.rows[0];

        // 2. Бүгүнкү жазуу бар экенин текшерүү
        const existingLog = await req.db.query(
            'SELECT * FROM attendance_logs WHERE student_id = $1 AND log_date = $2',
            [studentData.id, today]
        );

        let finalStatus = 'PRESENT';
        let logResult;

        if (existingLog.rows.length === 0) {
            // КИРҮҮ (CHECK-IN)
            finalStatus = calculateAttendanceStatus(currentTime, null, null);
            logResult = await req.db.query(
                `INSERT INTO attendance_logs (id, student_id, student_class, log_date, check_in_time, status)
                 VALUES (gen_random_uuid(), $1, $2, $3, $4, $5) RETURNING *`,
                [studentData.id, studentData.student_class, today, currentTime, finalStatus]
            );

            // Ата-энеге E-mail эскертүү жөнөтүү
            transporter.sendMail({
                from: '"Bilimal Мектеп Системасы" <notifications@bilimal.org>',
                to: studentData.parent_email,
                subject: `Мектепке келүү: ${studentData.full_name}`,
                text: `Саламатсызбы! Сиздин балаңыз ${studentData.full_name} саат ${currentTime} мектепке келди. Статус: ${finalStatus}`
            }).catch(err => console.error('Email error:', err));

            return res.status(200).json({
                success: true,
                type: 'CHECK_IN',
                message: `Мектепке кирүү катталды: ${studentData.full_name}`,
                data: logResult.rows[0]
            });

        } else {
            // ЧЫГУУ (CHECK-OUT)
            const currentRecord = existingLog.rows[0];
            
            if (currentRecord.check_out_time) {
                return res.status(400).json({ 
                    success: false, 
                    message: 'Бүгүнкү күнгө кирүү жана чыгуу буга чейин толук катталган!' 
                });
            }

            finalStatus = calculateAttendanceStatus(currentRecord.check_in_time, currentTime, null);

            logResult = await req.db.query(
                `UPDATE attendance_logs 
                 SET check_out_time = $1, status = $2, updated_at = CURRENT_TIMESTAMP
                 WHERE id = $3 RETURNING *`,
                [currentTime, finalStatus, currentRecord.id]
            );

            return res.status(200).json({
                success: true,
                type: 'CHECK_OUT',
                message: `Мектептен чыгуу катталды: ${studentData.full_name}`,
                data: logResult.rows[0]
            });
        }

    } catch (error) {
        console.error('QR Check Error:', error);
        return res.status(500).json({ success: false, message: 'Серверде ката чыкты' });
    }
};

// Класс боюнча статистика алуу (RBAC + Ownership Корголгон)
const getClassAttendance = async (req, res) => {
    try {
        const { studentClass } = req.params;
        const date = req.query.date || new Date().toISOString().split('T')[0];

        const query = `
            SELECT s.id, s.full_name, s.student_id_code, s.student_class,
                   a.check_in_time, a.check_out_time, 
                   COALESCE(a.status, 'ABSENT') as status
            FROM students s
            LEFT JOIN attendance_logs a ON s.id = a.student_id AND a.log_date = $1
            WHERE s.student_class = $2
            ORDER BY s.full_name ASC;
        `;

        const result = await req.db.query(query, [date, studentClass]);
        return res.status(200).json({ success: true, class: studentClass, date, data: result.rows });
    } catch (error) {
        console.error('Get Attendance Error:', error);
        return res.status(500).json({ success: false, message: 'Сервердик ката' });
    }
};

module.exports = {
    processQRCheck,
    getClassAttendance
};
