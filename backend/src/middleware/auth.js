const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'bilimal_super_secret_jwt_key_2026';

// 1. JWT Аутентификация текшерүү
const authenticateToken = (req, res, next) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ success: false, message: 'Уруксат берилген жок (Токен жок)' });
    }

    jwt.verify(token, JWT_SECRET, (err, user) => {
        if (err) {
            return res.status(403).json({ success: false, message: 'Сессия бүттү же токен жараксыз' });
        }
        req.user = user;
        next();
    });
};

// 2. Роль боюнча текшерүү (RBAC)
const authorizeRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user || !roles.includes(req.user.role)) {
            return res.status(403).json({ success: false, message: 'Бул аракетти аткарууга сизде укук жок (403 Forbidden)' });
        }
        next();
    };
};

// 3. Класс боюнча менчик укугун текшерүү (Strict Ownership Policy)
const verifyClassOwnership = (req, res, next) => {
    const targetClass = req.params.studentClass || req.body.studentClass || req.query.studentClass;

    if (req.user.role === 'ADMIN') {
        return next(); // Админ бардык класска кире алат
    }

    if (req.user.role === 'CURATOR') {
        if (!req.user.assignedClass || req.user.assignedClass !== targetClass) {
            return res.status(403).json({ 
                success: false, 
                message: '403 Forbidden: Сиз бир гана өзүңүздүн классыңызды куратор катары башкара аласыз!' 
            });
        }
        return next();
    }

    return res.status(403).json({ success: false, message: '403 Forbidden: Киришке укук жок' });
};

module.exports = {
    authenticateToken,
    authorizeRoles,
    verifyClassOwnership
};
