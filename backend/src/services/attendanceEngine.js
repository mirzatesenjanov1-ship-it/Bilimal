// Автоматтык катышуу убактысын эсептөөчү бизнес-логика
const calculateAttendanceStatus = (checkIn, checkOut, settings) => {
    const config = settings || {
        check_in_on_time: '08:15:00',
        check_in_late: '09:00:00',
        check_out_min: '13:00:00'
    };

    if (!checkIn) {
        return 'ABSENT'; // Келген жок
    }

    if (checkIn <= config.check_in_on_time) {
        if (!checkOut) return 'PRESENT'; // Толук келди
        if (checkOut < config.check_out_min) return 'INCOMPLETE'; // Эрте кетип калды
        return 'PRESENT';
    }

    if (checkIn > config.check_in_on_time && checkIn <= config.check_in_late) {
        if (checkOut && checkOut < config.check_out_min) return 'INCOMPLETE';
        return 'LATE'; // Кеч келди
    }

    return 'INCOMPLETE';
};

module.exports = { calculateAttendanceStatus };
