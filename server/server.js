require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const nodemailer = require("nodemailer");
const fs = require("fs");
const path = require("path");

const app = express();

app.use(express.json());
app.use(cors());

mongoose
    .connect(process.env.MONGO_URI)
    .then(() => console.log("MongoDB Connected"))
    .catch((err) => console.error("MongoDB Connection Error:", err));

const getAdminData = () => {
    const adminFiles = [
        path.join(__dirname, "admins.json"),
        path.join(process.cwd(), "admins.json"),
        path.join(process.cwd(), "server", "admins.json"),
    ];

    for (const filePath of adminFiles) {
        try {
            if (!fs.existsSync(filePath)) continue;

            const data = fs.readFileSync(filePath, "utf-8");
            const admins = JSON.parse(data);

            if (Array.isArray(admins)) {
                return admins;
            }
        } catch (error) {
            console.error(`Error reading admins.json at ${filePath}:`, error.message);
        }
    }

    if (process.env.ADMIN_USERNAME && process.env.ADMIN_PASSWORD) {
        return [{
            username: process.env.ADMIN_USERNAME,
            password: process.env.ADMIN_PASSWORD,
        }, ];
    }

    console.error("No admin credentials found. Add server/admins.json or ADMIN_USERNAME/ADMIN_PASSWORD in .env");
    return [];
};

const generateQRVersion = () => {
    return `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    mobile: String,
    password: String,
    emailVerified: {
        type: Boolean,
        default: false,
    },
    emailVerifiedAt: Date,
    currentQrVersion: {
        type: String,
        default: "",
    },
});

const User = mongoose.model("User", userSchema);
const registrationOtpSchema = new mongoose.Schema({
    username: String,
    email: {
        type: String,
        required: true,
        index: true,
    },
    mobile: String,
    password: String,
    otp: {
        type: String,
        required: true,
    },
    expiresAt: {
        type: Date,
        required: true,
    },
    verified: {
        type: Boolean,
        default: false,
    },
}, { timestamps: true });

registrationOtpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

const RegistrationOtp = mongoose.model(
    "RegistrationOtp",
    registrationOtpSchema
);

const normalizeEmail = (email = "") => {
    return String(email || "").trim().toLowerCase();
};

const generateFourDigitOtp = () => {
    return String(Math.floor(1000 + Math.random() * 9000));
};

const isValidEmail = (email = "") => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email).trim());
};

const bookingSchema = new mongoose.Schema({
    username: String,
    email: String,
    service: String,
    bookingTime: String,
    status: {
        type: String,
        default: "pending",
    },
});

const Booking = mongoose.model("Booking", bookingSchema);

const Service = mongoose.model(
    "Service",
    new mongoose.Schema({
        title: String,
        description: String,
        image: String,
    })
);

const attendanceSchema = new mongoose.Schema({
    userId: String,
    name: String,
    username: String,
    email: String,
    mobile: String,
    date: String,

    entryTime: Date,
    breakOutTime: Date,
    breakInTime: Date,
    lastOutTime: Date,

    totalBreakSeconds: {
        type: Number,
        default: 0,
    },

    totalWorkSeconds: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

const isMissingValue = (value) => {
    return value === undefined || value === null || String(value).trim() === "" || String(value).trim() === "-";
};

const getEmployeeIdentity = (employee = {}) => {
    return {
        name: employee.name || employee.username || "-",
        username: employee.username || "-",
        email: employee.email || "-",
        mobile: employee.mobile || "-",
    };
};

const buildUserLookupFilter = (value) => {
    const stringValue = String(value || "").trim();

    if (!stringValue) {
        return null;
    }

    const or = [
        { email: stringValue },
        { username: stringValue },
        { mobile: stringValue },
    ];

    if (mongoose.Types.ObjectId.isValid(stringValue)) {
        or.unshift({ _id: stringValue });
    }

    return { $or: or };
};

const findUserByIdentifier = async(value) => {
    const filter = buildUserLookupFilter(value);

    if (!filter) return null;

    return User.findOne(filter).select("_id username email mobile currentQrVersion");
};

const enrichAttendanceRecords = async(records = []) => {
    const plainRecords = records.map((record) =>
        typeof record.toObject === "function" ? record.toObject() : {...record }
    );

    const lookupValues = new Set();

    plainRecords.forEach((record) => {
        [record.userId, record.email, record.username, record.mobile].forEach((value) => {
            if (value) lookupValues.add(String(value));
        });
    });

    const values = Array.from(lookupValues);

    if (values.length === 0) {
        return plainRecords;
    }

    const objectIds = values.filter((value) => mongoose.Types.ObjectId.isValid(value));

    const users = await User.find({
        $or: [
            objectIds.length ? { _id: { $in: objectIds } } : null,
            { email: { $in: values } },
            { username: { $in: values } },
            { mobile: { $in: values } },
        ].filter(Boolean),
    }).select("_id username email mobile currentQrVersion");

    const userMap = new Map();

    users.forEach((user) => {
        const keys = [user._id, user.email, user.username, user.mobile]
            .filter(Boolean)
            .map((value) => String(value));

        keys.forEach((key) => userMap.set(key, user));
    });

    return plainRecords.map((record) => {
        const employee =
            userMap.get(String(record.userId || "")) ||
            userMap.get(String(record.email || "")) ||
            userMap.get(String(record.username || "")) ||
            userMap.get(String(record.mobile || ""));

        if (!employee) {
            return record;
        }

        const identity = getEmployeeIdentity(employee);

        return {
            ...record,
            userId: record.userId || String(employee._id),
            name: isMissingValue(record.name) ? identity.name : record.name,
            username: isMissingValue(record.username) ? identity.username : record.username,
            email: isMissingValue(record.email) ? identity.email : record.email,
            mobile: isMissingValue(record.mobile) ? identity.mobile : record.mobile,
        };
    });
};

const shiftScheduleSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
        index: true,
    },
    employeeUsername: {
        type: String,
        required: true,
    },
    employeeEmail: String,
    date: {
        type: String,
        required: true,
    },
    year: {
        type: Number,
        required: true,
    },
    month: {
        type: Number,
        required: true,
    },
    dayOfWeek: {
        type: Number,
        min: 0,
        max: 6,
        required: true,
    },
    status: {
        type: String,
        enum: ["working", "off", "leave", "holiday"],
        default: "working",
    },
    startTime: {
        type: String,
        default: "",
    },
    breakStartTime: {
        type: String,
        default: "",
    },
    breakEndTime: {
        type: String,
        default: "",
    },
    endTime: {
        type: String,
        default: "",
    },
    notes: {
        type: String,
        default: "",
        maxlength: 500,
    },
    createdBy: {
        type: String,
        default: "Admin",
    },
}, { timestamps: true });

shiftScheduleSchema.index({ employeeId: 1, date: 1 }, { unique: true });
shiftScheduleSchema.index({ year: 1, month: 1 });

const ShiftSchedule = mongoose.model("ShiftSchedule", shiftScheduleSchema);

const announcementSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1500,
    },
    type: {
        type: String,
        enum: ["employee", "public"],
        default: "employee",
    },
    sendEmail: {
        type: Boolean,
        default: false,
    },
    showPopup: {
        type: Boolean,
        default: true,
    },
    createdBy: {
        type: String,
        default: "Admin",
    },
}, { timestamps: true });

const Announcement = mongoose.model("Announcement", announcementSchema);

const personalNotificationSchema = new mongoose.Schema({
    employeeId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        required: true,
    },
    employeeName: String,
    employeeUsername: String,
    employeeEmail: String,
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100,
    },
    message: {
        type: String,
        required: true,
        trim: true,
        maxlength: 1500,
    },
    priority: {
        type: String,
        enum: ["normal", "important", "urgent"],
        default: "normal",
    },
    sendEmail: {
        type: Boolean,
        default: false,
    },
    showPopup: {
        type: Boolean,
        default: true,
    },
    isRead: {
        type: Boolean,
        default: false,
    },
    readAt: Date,
    createdBy: {
        type: String,
        default: "Admin",
    },
}, { timestamps: true });

const PersonalNotification = mongoose.model(
    "PersonalNotification",
    personalNotificationSchema
);


const auditLogSchema = new mongoose.Schema({
    category: {
        type: String,
        default: "General",
        index: true,
    },
    action: {
        type: String,
        required: true,
        index: true,
    },
    adminUsername: {
        type: String,
        default: "System",
        index: true,
    },
    description: {
        type: String,
        required: true,
        maxlength: 1000,
    },
    targetType: {
        type: String,
        default: "",
    },
    targetId: {
        type: String,
        default: "",
    },
    targetName: {
        type: String,
        default: "",
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    ipAddress: {
        type: String,
        default: "",
    },
    userAgent: {
        type: String,
        default: "",
    },
}, { timestamps: true });

auditLogSchema.index({ createdAt: -1 });
auditLogSchema.index({ category: 1, createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);


// ===========================
// REALTIME EVENT STREAM (SSE)
// ===========================

const realtimeClients = {
    admins: new Set(),
    employees: new Map(),
};

const writeRealtimeEvent = (res, eventName, payload = {}) => {
    try {
        res.write(`event: ${eventName}\n`);
        res.write(`data: ${JSON.stringify(payload)}\n\n`);
    } catch (error) {
        console.error("Realtime write error ignored:", error.message);
    }
};

const emitRealtimeToAdmins = (eventName, payload = {}) => {
    realtimeClients.admins.forEach((client) => {
        writeRealtimeEvent(client.res, eventName, payload);
    });
};

const getEmployeeRealtimeKeys = (employee = {}) => {
    return [
            employee._id,
            employee.id,
            employee.userId,
            employee.employeeId,
            employee.email,
            employee.username,
        ]
        .filter(Boolean)
        .map((value) => String(value));
};

const addEmployeeRealtimeClient = (key, client) => {
    if (!key) return;

    if (!realtimeClients.employees.has(key)) {
        realtimeClients.employees.set(key, new Set());
    }

    realtimeClients.employees.get(key).add(client);
};

const removeEmployeeRealtimeClient = (client) => {
    realtimeClients.employees.forEach((set, key) => {
        set.delete(client);

        if (set.size === 0) {
            realtimeClients.employees.delete(key);
        }
    });
};

const emitRealtimeToEmployee = (employeeKeys = [], eventName, payload = {}) => {
    const keys = Array.isArray(employeeKeys) ? employeeKeys : [employeeKeys];
    const delivered = new Set();

    keys.filter(Boolean).map(String).forEach((key) => {
        const clients = realtimeClients.employees.get(key);

        if (!clients) return;

        clients.forEach((client) => {
            if (delivered.has(client.id)) return;
            delivered.add(client.id);
            writeRealtimeEvent(client.res, eventName, payload);
        });
    });
};

const emitRealtimeToAllEmployees = (eventName, payload = {}) => {
    const delivered = new Set();

    realtimeClients.employees.forEach((clients) => {
        clients.forEach((client) => {
            if (delivered.has(client.id)) return;
            delivered.add(client.id);
            writeRealtimeEvent(client.res, eventName, payload);
        });
    });
};

const createAuditLog = async(req, options = {}) => {
    try {
        const log = await AuditLog.create({
            category: options.category || "General",
            action: options.action || "ACTION",
            adminUsername: (req && req.admin && req.admin.username) || options.adminUsername || "System",
            description: options.description || "Admin activity recorded",
            targetType: options.targetType || "",
            targetId: options.targetId ? String(options.targetId) : "",
            targetName: options.targetName || "",
            metadata: options.metadata || {},
            ipAddress: (req && req.ip) || (req && req.headers && req.headers["x-forwarded-for"]) || "",
            userAgent: (req && req.headers && req.headers["user-agent"]) || "",
        });

        emitRealtimeToAdmins("activityLogCreated", {
            message: log.description,
            log,
            createdAt: log.createdAt,
        });

        return log;
    } catch (error) {
        console.error("Audit log error ignored:", error.message);
        return null;
    }
};

const verifyToken = (req, res, next) => {
    const token = req.headers.authorization ?
        req.headers.authorization.split(" ")[1] :
        null;

    if (!token) return res.status(401).json({ error: "Unauthorized" });

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) return res.status(403).json({ error: "Invalid token" });

        req.user = decoded;
        next();
    });
};

const verifyAdmin = (req, res, next) => {
    const token = req.headers.authorization ?
        req.headers.authorization.split(" ")[1] :
        null;

    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Admin authorization required",
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err || !decoded.isAdmin) {
            return res.status(403).json({
                success: false,
                message: "Invalid admin token",
            });
        }

        req.admin = decoded;
        next();
    });
};


// ===========================
// REALTIME ROUTES
// ===========================

app.get("/api/realtime/admin-stream", (req, res) => {
    const token = req.query.token ? String(req.query.token) : "";

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err || !decoded || !decoded.isAdmin) {
            res.status(401).json({
                success: false,
                message: "Admin authorization required",
            });
            return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        const client = {
            id: `admin-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            res,
            adminUsername: decoded.username || "Admin",
            connectedAt: new Date(),
        };

        realtimeClients.admins.add(client);

        writeRealtimeEvent(res, "connected", {
            role: "admin",
            message: "Realtime admin stream connected",
            connectedAt: client.connectedAt,
        });

        const interval = setInterval(() => {
            writeRealtimeEvent(res, "ping", { time: new Date().toISOString() });
        }, 25000);

        req.on("close", () => {
            clearInterval(interval);
            realtimeClients.admins.delete(client);
        });
    });
});

app.get("/api/realtime/employee-stream", (req, res) => {
    const token = req.query.token ? String(req.query.token) : "";

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err || !decoded) {
            res.status(401).json({
                success: false,
                message: "Employee authorization required",
            });
            return;
        }

        res.setHeader("Content-Type", "text/event-stream");
        res.setHeader("Cache-Control", "no-cache");
        res.setHeader("Connection", "keep-alive");
        res.setHeader("X-Accel-Buffering", "no");

        if (typeof res.flushHeaders === "function") {
            res.flushHeaders();
        }

        const client = {
            id: `employee-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            res,
            employee: decoded,
            connectedAt: new Date(),
        };

        getEmployeeRealtimeKeys(decoded).forEach((key) => addEmployeeRealtimeClient(key, client));

        writeRealtimeEvent(res, "connected", {
            role: "employee",
            message: "Realtime employee stream connected",
            connectedAt: client.connectedAt,
        });

        const interval = setInterval(() => {
            writeRealtimeEvent(res, "ping", { time: new Date().toISOString() });
        }, 25000);

        req.on("close", () => {
            clearInterval(interval);
            removeEmployeeRealtimeClient(client);
        });
    });
});

app.get("/api/realtime/status", verifyAdmin, (req, res) => {
    let employeeConnections = 0;

    realtimeClients.employees.forEach((set) => {
        employeeConnections += set.size;
    });

    res.json({
        success: true,
        data: {
            adminConnections: realtimeClients.admins.size,
            employeeConnections,
            employeeKeys: realtimeClients.employees.size,
            time: new Date().toISOString(),
        },
    });
});

const createMailTransporter = () => {
    if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
        return null;
    }

    return nodemailer.createTransport({
        service: "gmail",
        auth: {
            user: process.env.EMAIL_USER,
            pass: process.env.EMAIL_PASS,
        },
    });
};

const sendEmail = async({ to, subject, text }) => {
    const transporter = createMailTransporter();

    if (!transporter) {
        return {
            sent: false,
            reason: "Email is not configured",
        };
    }

    await transporter.sendMail({
        from: `"Cargo Force Notifications" <${process.env.EMAIL_USER}>`,
        to,
        subject,
        text,
    });

    return { sent: true };
};
app.post("/api/auth/send-registration-otp", async(req, res) => {
    try {
        const username = String(req.body.username || "").trim();
        const email = normalizeEmail(req.body.email);
        const mobile = String(req.body.mobile || "").trim();
        const password = String(req.body.password || "").trim();

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username, email and password are required",
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                message: "Please enter a valid email address",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        const existingUser = await User.findOne({
            $or: [
                { email },
                { username },
                ...(mobile ? [{ mobile }] : []),
            ],
        });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "User already exists with this email, username or mobile",
            });
        }

        if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
            return res.status(500).json({
                success: false,
                message: "Email OTP service is not configured. Add EMAIL_USER and EMAIL_PASS in .env",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = generateFourDigitOtp();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

        await RegistrationOtp.deleteMany({ email });

        await RegistrationOtp.create({
            username,
            email,
            mobile,
            password: hashedPassword,
            otp,
            expiresAt,
        });

        await sendEmail({
            to: email,
            subject: "Cargo Force Registration OTP",
            text: `Your Cargo Force registration OTP is ${otp}. This OTP is valid for 10 minutes.

Do not share this OTP with anyone.

Cargo Force Administration`,
        });

        res.json({
            success: true,
            message: "OTP sent to your email. Please verify to complete registration.",
        });
    } catch (error) {
        console.error("Send registration OTP error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send registration OTP",
        });
    }
});
app.post("/register", async(req, res) => {
    try {
        const email = normalizeEmail(req.body.email);
        const otp = String(req.body.otp || "").trim();

        if (!email || !otp) {
            return res.status(400).json({
                success: false,
                error: "Email and OTP are required",
            });
        }

        if (!isValidEmail(email)) {
            return res.status(400).json({
                success: false,
                error: "Please enter a valid email address",
            });
        }

        const otpRecord = await RegistrationOtp.findOne({
            email,
            otp,
            verified: false,
            expiresAt: { $gt: new Date() },
        });

        if (!otpRecord) {
            return res.status(400).json({
                success: false,
                error: "Invalid or expired OTP",
            });
        }

        const existingUser = await User.findOne({
            $or: [
                { email: otpRecord.email },
                { username: otpRecord.username },
                ...(otpRecord.mobile ? [{ mobile: otpRecord.mobile }] : []),
            ],
        });

        if (existingUser) {
            await RegistrationOtp.deleteMany({ email });
            return res.status(400).json({
                success: false,
                error: "User already exists",
            });
        }

        const firstQrVersion = generateQRVersion();

        const newUser = new User({
            username: otpRecord.username,
            email: otpRecord.email,
            mobile: otpRecord.mobile,
            password: otpRecord.password,
            emailVerified: true,
            emailVerifiedAt: new Date(),
            currentQrVersion: firstQrVersion,
        });

        await newUser.save();

        otpRecord.verified = true;
        await otpRecord.save();

        await RegistrationOtp.deleteMany({ email });

        res.status(201).json({
            success: true,
            message: "Email verified and user registered successfully",
        });
    } catch (error) {
        console.error("Registration verify OTP error:", error);
        res.status(500).json({
            success: false,
            error: "Registration failed",
        });
    }
});


app.post("/login", async(req, res) => {
    try {
        const identifier = String(req.body.identifier || req.body.email || req.body.username || req.body.mobile || "").trim();
        const { password } = req.body;

        if (!identifier || !password) {
            return res.status(400).json({ error: "Email/mobile/username and password are required" });
        }

        const user = await User.findOne({
            $or: [
                { email: identifier.toLowerCase() },
                { username: identifier },
                { mobile: identifier },
            ],
        });

        if (!user) return res.status(400).json({ error: "User not found" });

        if (!user.currentQrVersion) {
            user.currentQrVersion = generateQRVersion();
            await user.save();
        }

        const isMatch = await bcrypt.compare(password, user.password);

        if (!isMatch) return res.status(400).json({ error: "Invalid password" });

        const token = jwt.sign({
                id: user._id,
                username: user.username,
                email: user.email,
                mobile: user.mobile || "",
                currentQrVersion: user.currentQrVersion || "",
            },
            process.env.JWT_SECRET, { expiresIn: "1h" }
        );

        res.json({
            token,
            username: user.username,
            email: user.email,
            mobile: user.mobile || "",
            currentQrVersion: user.currentQrVersion,
        });
    } catch (error) {
        res.status(500).json({
            error: "Login failed",
        });
    }
});

app.post("/admin-login", async(req, res) => {
    try {
        const { username, password } = req.body;

        const adminData = getAdminData();

        const admin = adminData.find(
            (admin) =>
            admin.username.trim() === username.trim() &&
            admin.password.trim() === password.trim()
        );

        if (!admin) {
            return res.status(400).json({
                error: "Invalid Admin Credentials",
            });
        }

        const token = jwt.sign({
                username: admin.username,
                isAdmin: true,
            },
            process.env.JWT_SECRET, { expiresIn: "1h" }
        );

        await createAuditLog(req, {
            category: "Authentication",
            action: "ADMIN_LOGIN",
            adminUsername: admin.username,
            description: `Admin ${admin.username} logged in`,
            targetType: "Admin",
            targetName: admin.username,
        });

        res.json({ token });
    } catch (error) {
        res.status(500).json({
            error: "Admin login failed",
        });
    }
});

app.post("/api/user/generate-qr", verifyToken, async(req, res) => {
    try {
        const newQrVersion = generateQRVersion();

        const user = await User.findByIdAndUpdate(
            req.user.id, { currentQrVersion: newQrVersion }, { new: true }
        );

        if (!user) {
            return res.status(404).json({
                success: false,
                message: "User not found",
            });
        }

        res.json({
            success: true,
            qrVersion: user.currentQrVersion,
            message: "New QR generated successfully. Old QR is now disabled.",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to generate new QR",
        });
    }
});

app.get("/bookings", verifyToken, async(req, res) => {
    try {
        const bookings = await Booking.find();
        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch bookings" });
    }
});

app.get("/user-bookings", verifyToken, async(req, res) => {
    try {
        const bookings = await Booking.find({ email: req.user.email }).sort({
            bookingTime: -1,
        });

        res.json(bookings);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch user bookings" });
    }
});

app.post("/book", verifyToken, async(req, res) => {
    try {
        const { service, bookingTime } = req.body;

        const existingBooking = await Booking.findOne({ bookingTime });

        if (existingBooking) {
            return res.status(400).json({
                error: "This time slot is already booked",
            });
        }

        const newBooking = new Booking({
            username: req.user.username,
            email: req.user.email,
            service,
            bookingTime,
        });

        await newBooking.save();

        res.json({
            message: "Service booked successfully",
        });
    } catch (error) {
        res.status(500).json({
            error: "Failed to book service",
        });
    }
});

app.patch("/bookings/:id/cancel", verifyToken, async(req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id, { status: "cancelled" }, { new: true }
        );

        if (!booking) return res.status(404).json({ error: "Booking not found" });

        res.json({
            message: "Booking Cancelled",
            booking,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to cancel booking" });
    }
});

app.patch("/bookings/:id/done", verifyToken, async(req, res) => {
    try {
        const booking = await Booking.findByIdAndUpdate(
            req.params.id, { status: "done" }, { new: true }
        );

        if (!booking) return res.status(404).json({ error: "Booking not found" });

        res.json({
            message: "Booking marked as Done",
            booking,
        });
    } catch (error) {
        res.status(500).json({ error: "Failed to update booking" });
    }
});

// ===========================
// ANNOUNCEMENTS
// ===========================

app.get("/api/announcements/public", verifyToken, async(req, res) => {
    try {
        const announcements = await Announcement.find({ type: "public" }).sort({
            createdAt: -1,
        });

        res.json({
            success: true,
            data: announcements,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch public announcements",
        });
    }
});

app.get("/api/announcements/employee", verifyToken, async(req, res) => {
    try {
        const announcements = await Announcement.find({
            type: "employee",
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: announcements,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch employee announcements",
        });
    }
});

app.get("/api/announcements/admin", verifyAdmin, async(req, res) => {
    try {
        const announcements = await Announcement.find().sort({
            createdAt: -1,
        });

        res.json({
            success: true,
            data: announcements,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch announcements",
        });
    }
});

app.post("/api/announcements", verifyAdmin, async(req, res) => {
    try {
        const {
            title,
            message,
            type = "employee",
            sendEmail: shouldSendEmail = false,
            showPopup = true,
        } = req.body;

        if (!title || !message) {
            return res.status(400).json({
                success: false,
                message: "Title and message are required",
            });
        }

        if (!["employee", "public"].includes(type)) {
            return res.status(400).json({
                success: false,
                message: "Invalid announcement type",
            });
        }

        const announcement = await Announcement.create({
            title,
            message,
            type,
            sendEmail: Boolean(shouldSendEmail),
            showPopup: Boolean(showPopup),
            createdBy: req.admin.username || "Admin",
        });

        let emailMessage = "";

        if (shouldSendEmail) {
            const employees = await User.find({
                email: { $exists: true, $ne: "" },
            }).select("email");

            if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
                emailMessage =
                    " Announcement saved, but email is not configured in .env.";
            } else if (employees.length === 0) {
                emailMessage =
                    " Announcement saved, but no employee emails were found.";
            } else {
                const results = await Promise.allSettled(
                    employees.map((employee) =>
                        sendEmail({
                            to: employee.email,
                            subject: `Cargo Force: ${title}`,
                            text: `${title}\n\n${message}\n\nCargo Force Administration`,
                        })
                    )
                );

                const sentCount = results.filter(
                    (result) => result.status === "fulfilled"
                ).length;

                emailMessage = ` Email sent to ${sentCount} of ${employees.length} employees.`;
            }
        }

        await createAuditLog(req, {
            category: "Announcements",
            action: "CREATE_ANNOUNCEMENT",
            description: `Created ${type} announcement: ${title}`,
            targetType: "Announcement",
            targetId: announcement._id,
            targetName: title,
            metadata: { type, sendEmail: Boolean(shouldSendEmail), showPopup: Boolean(showPopup) },
        });

        emitRealtimeToAdmins("announcementCreated", {
            message: `Announcement created: ${title}`,
            announcement,
            createdAt: new Date(),
        });

        if (type === "employee" || type === "public") {
            emitRealtimeToAllEmployees("announcementCreated", {
                message: title,
                announcement,
                createdAt: new Date(),
            });
        }

        res.status(201).json({
            success: true,
            message: `Announcement sent successfully.${emailMessage}`,
            data: announcement,
        });
    } catch (error) {
        console.error("Create announcement error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send announcement",
        });
    }
});

app.delete("/api/announcements/:id", verifyAdmin, async(req, res) => {
    try {
        const announcement = await Announcement.findByIdAndDelete(req.params.id);

        if (!announcement) {
            return res.status(404).json({
                success: false,
                message: "Announcement not found",
            });
        }

        await createAuditLog(req, {
            category: "Announcements",
            action: "DELETE_ANNOUNCEMENT",
            description: `Deleted announcement: ${announcement.title}`,
            targetType: "Announcement",
            targetId: announcement._id,
            targetName: announcement.title,
        });

        res.json({
            success: true,
            message: "Announcement deleted successfully",
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete announcement",
        });
    }
});

// ===========================
// PERSONAL NOTIFICATIONS
// ===========================


// ===========================
// EMPLOYEE MANAGEMENT
// ===========================

const buildEmployeeSearchFilter = (search = "") => {
    const value = String(search || "").trim();

    if (!value) return {};

    const safeSearch = value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const regex = new RegExp(safeSearch, "i");

    return {
        $or: [
            { username: regex },
            { email: regex },
            { mobile: regex },
        ],
    };
};

const cleanEmployeePayload = ({ username, email, mobile }) => ({
    username: String(username || "").trim(),
    email: String(email || "").trim().toLowerCase(),
    mobile: String(mobile || "").trim(),
});

const buildEmployeeStatsMap = async(employees) => {
    const statsMap = new Map();
    const employeeKeys = [];

    employees.forEach((employee) => {
        const id = String(employee._id);
        const keys = [id, employee.email, employee.username].filter(Boolean).map(String);

        keys.forEach((key) => {
            employeeKeys.push(key);
            if (!statsMap.has(key)) {
                statsMap.set(key, {
                    attendanceRecords: 0,
                    totalWorkSeconds: 0,
                    totalBreakSeconds: 0,
                    plannedShifts: 0,
                    personalNotifications: 0,
                });
            }
        });
    });

    if (employeeKeys.length === 0) return statsMap;

    const [attendanceStats, shiftStats, notificationStats] = await Promise.all([
        Attendance.aggregate([{
                $match: {
                    $or: [
                        { userId: { $in: employeeKeys } },
                        { email: { $in: employeeKeys } },
                        { username: { $in: employeeKeys } },
                    ],
                },
            },
            {
                $group: {
                    _id: "$userId",
                    records: { $sum: 1 },
                    totalWorkSeconds: { $sum: { $ifNull: ["$totalWorkSeconds", 0] } },
                    totalBreakSeconds: { $sum: { $ifNull: ["$totalBreakSeconds", 0] } },
                },
            },
        ]),
        ShiftSchedule.aggregate([{
                $match: {
                    employeeId: { $in: employees.map((employee) => employee._id) },
                },
            },
            {
                $group: {
                    _id: "$employeeId",
                    plannedShifts: { $sum: 1 },
                },
            },
        ]),
        PersonalNotification.aggregate([{
                $match: {
                    employeeId: { $in: employees.map((employee) => employee._id) },
                },
            },
            {
                $group: {
                    _id: "$employeeId",
                    personalNotifications: { $sum: 1 },
                },
            },
        ]),
    ]);

    attendanceStats.forEach((item) => {
        const key = String(item._id || "unknown");
        const current = statsMap.get(key) || {
            attendanceRecords: 0,
            totalWorkSeconds: 0,
            totalBreakSeconds: 0,
            plannedShifts: 0,
            personalNotifications: 0,
        };

        current.attendanceRecords += Number(item.records) || 0;
        current.totalWorkSeconds += Number(item.totalWorkSeconds) || 0;
        current.totalBreakSeconds += Number(item.totalBreakSeconds) || 0;
        statsMap.set(key, current);
    });

    shiftStats.forEach((item) => {
        const key = String(item._id || "unknown");
        const current = statsMap.get(key) || {
            attendanceRecords: 0,
            totalWorkSeconds: 0,
            totalBreakSeconds: 0,
            plannedShifts: 0,
            personalNotifications: 0,
        };

        current.plannedShifts += Number(item.plannedShifts) || 0;
        statsMap.set(key, current);
    });

    notificationStats.forEach((item) => {
        const key = String(item._id || "unknown");
        const current = statsMap.get(key) || {
            attendanceRecords: 0,
            totalWorkSeconds: 0,
            totalBreakSeconds: 0,
            plannedShifts: 0,
            personalNotifications: 0,
        };

        current.personalNotifications += Number(item.personalNotifications) || 0;
        statsMap.set(key, current);
    });

    return statsMap;
};

app.get("/api/admin/employees", verifyAdmin, async(req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limitValue = parseInt(req.query.limit, 10) || 10;
        const limit = Math.min(Math.max(limitValue, 5), 100);
        const skip = (page - 1) * limit;
        const search = String(req.query.search || "").trim();
        const filter = buildEmployeeSearchFilter(search);

        const [employees, totalRecords, totalEmployees] = await Promise.all([
            User.find(filter)
            .select("_id username email mobile currentQrVersion createdAt updatedAt")
            .sort({ _id: -1 })
            .skip(skip)
            .limit(limit),
            User.countDocuments(filter),
            User.countDocuments(),
        ]);

        let statsMap = new Map();

        try {
            statsMap = await buildEmployeeStatsMap(employees);
        } catch (statsError) {
            console.error("Employee stats error ignored:", statsError.message);
            // Employee list must still load even if old attendance/shift data has mixed IDs.
        }

        const data = employees.map((employee) => {
            const id = String(employee._id);
            const emailKey = String(employee.email || "");
            const usernameKey = String(employee.username || "");
            const stats =
                statsMap.get(id) ||
                statsMap.get(emailKey) ||
                statsMap.get(usernameKey) || {
                    attendanceRecords: 0,
                    totalWorkSeconds: 0,
                    totalBreakSeconds: 0,
                    plannedShifts: 0,
                    personalNotifications: 0,
                };

            return {
                _id: employee._id,
                username: employee.username || "-",
                email: employee.email || "-",
                mobile: employee.mobile || "-",
                currentQrVersion: employee.currentQrVersion || "",
                createdAt: employee.createdAt || null,
                updatedAt: employee.updatedAt || null,
                attendanceRecords: Number(stats.attendanceRecords) || 0,
                totalWorkSeconds: Number(stats.totalWorkSeconds) || 0,
                totalBreakSeconds: Number(stats.totalBreakSeconds) || 0,
                plannedShifts: Number(stats.plannedShifts) || 0,
                personalNotifications: Number(stats.personalNotifications) || 0,
            };
        });

        const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

        res.json({
            success: true,
            data,
            stats: {
                totalEmployees,
                filteredEmployees: totalRecords,
            },
            pagination: {
                page,
                limit,
                totalRecords,
                totalPages,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
            },
        });
    } catch (error) {
        console.error("Fetch employees error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch employees",
            error: error.message,
        });
    }
});

app.post("/api/admin/employees", verifyAdmin, async(req, res) => {
    try {
        const { username, email, mobile } = cleanEmployeePayload(req.body);
        const password = String(req.body.password || "").trim();

        if (!username || !email || !password) {
            return res.status(400).json({
                success: false,
                message: "Username, email and password are required",
            });
        }

        if (password.length < 6) {
            return res.status(400).json({
                success: false,
                message: "Password must be at least 6 characters",
            });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: "Employee with this email already exists",
            });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const employee = await User.create({
            username,
            email,
            mobile,
            password: hashedPassword,
            currentQrVersion: generateQRVersion(),
        });

        await createAuditLog(req, {
            category: "Employees",
            action: "CREATE_EMPLOYEE",
            description: `Created employee ${employee.username}`,
            targetType: "Employee",
            targetId: employee._id,
            targetName: employee.username,
            metadata: { email: employee.email, mobile: employee.mobile },
        });

        emitRealtimeToAdmins("employeeCreated", {
            message: `Employee created: ${employee.username}`,
            employee: { _id: employee._id, username: employee.username, email: employee.email, mobile: employee.mobile },
            createdAt: new Date(),
        });

        res.status(201).json({
            success: true,
            message: "Employee created successfully",
            data: {
                _id: employee._id,
                username: employee.username,
                email: employee.email,
                mobile: employee.mobile,
                currentQrVersion: employee.currentQrVersion,
                createdAt: employee.createdAt,
            },
        });
    } catch (error) {
        console.error("Create employee error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to create employee",
            error: error.message,
        });
    }
});

app.put("/api/admin/employees/:id", verifyAdmin, async(req, res) => {
    try {
        const { username, email, mobile } = cleanEmployeePayload(req.body);
        const password = String(req.body.password || "").trim();

        if (!username || !email) {
            return res.status(400).json({
                success: false,
                message: "Username and email are required",
            });
        }

        const employee = await User.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const duplicateEmail = await User.findOne({
            email,
            _id: { $ne: employee._id },
        });

        if (duplicateEmail) {
            return res.status(400).json({
                success: false,
                message: "Another employee already uses this email",
            });
        }

        employee.username = username;
        employee.email = email;
        employee.mobile = mobile;

        if (password) {
            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: "Password must be at least 6 characters",
                });
            }

            employee.password = await bcrypt.hash(password, 10);
        }

        await employee.save();

        await createAuditLog(req, {
            category: "Employees",
            action: password ? "UPDATE_EMPLOYEE_WITH_PASSWORD" : "UPDATE_EMPLOYEE",
            description: password ? `Updated employee ${employee.username} and changed password` : `Updated employee ${employee.username}`,
            targetType: "Employee",
            targetId: employee._id,
            targetName: employee.username,
            metadata: { email: employee.email, mobile: employee.mobile, passwordChanged: Boolean(password) },
        });

        emitRealtimeToAdmins("employeeUpdated", {
            message: `Employee updated: ${employee.username}`,
            employee: { _id: employee._id, username: employee.username, email: employee.email, mobile: employee.mobile },
            createdAt: new Date(),
        });

        emitRealtimeToEmployee([employee._id, employee.email, employee.username], "myProfileUpdated", {
            message: "Your profile was updated by admin",
            createdAt: new Date(),
        });

        res.json({
            success: true,
            message: password ? "Employee and password updated successfully" : "Employee updated successfully",
            data: {
                _id: employee._id,
                username: employee.username,
                email: employee.email,
                mobile: employee.mobile,
                currentQrVersion: employee.currentQrVersion,
                updatedAt: employee.updatedAt,
            },
        });
    } catch (error) {
        console.error("Update employee error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update employee",
            error: error.message,
        });
    }
});

app.patch("/api/admin/employees/:id/regenerate-qr", verifyAdmin, async(req, res) => {
    try {
        const employee = await User.findByIdAndUpdate(
            req.params.id, { currentQrVersion: generateQRVersion() }, { new: true }
        ).select("_id username email mobile currentQrVersion updatedAt");

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        await createAuditLog(req, {
            category: "Employees",
            action: "REGENERATE_EMPLOYEE_QR",
            description: `Regenerated QR for employee ${employee.username}`,
            targetType: "Employee",
            targetId: employee._id,
            targetName: employee.username,
            metadata: { email: employee.email },
        });

        emitRealtimeToAdmins("employeeQrRegenerated", {
            message: `QR regenerated for ${employee.username}`,
            employee,
            createdAt: new Date(),
        });

        emitRealtimeToEmployee([employee._id, employee.email, employee.username], "myQrRegenerated", {
            message: "Your QR was regenerated by admin. Please login again or refresh your profile.",
            createdAt: new Date(),
        });

        res.json({
            success: true,
            message: "Employee QR regenerated successfully. Old QR will stop working.",
            data: employee,
        });
    } catch (error) {
        console.error("Regenerate employee QR error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to regenerate employee QR",
            error: error.message,
        });
    }
});

app.delete("/api/admin/employees/:id", verifyAdmin, async(req, res) => {
    try {
        const deleteData = String(req.query.deleteData || "false") === "true";
        const employee = await User.findById(req.params.id);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const employeeId = String(employee._id);
        const employeeEmail = employee.email || "";
        const employeeUsername = employee.username || "";

        await User.findByIdAndDelete(employee._id);

        let deletedData = {
            attendance: 0,
            shifts: 0,
            notifications: 0,
        };

        if (deleteData) {
            const [attendanceResult, shiftResult, notificationResult] = await Promise.all([
                Attendance.deleteMany({
                    $or: [
                        { userId: employeeId },
                        { email: employeeEmail },
                        { username: employeeUsername },
                    ],
                }),
                ShiftSchedule.deleteMany({ employeeId: employee._id }),
                PersonalNotification.deleteMany({ employeeId: employee._id }),
            ]);

            deletedData = {
                attendance: attendanceResult.deletedCount || 0,
                shifts: shiftResult.deletedCount || 0,
                notifications: notificationResult.deletedCount || 0,
            };
        }

        await createAuditLog(req, {
            category: "Employees",
            action: deleteData ? "DELETE_EMPLOYEE_WITH_DATA" : "DELETE_EMPLOYEE",
            description: deleteData ? `Deleted employee ${employeeUsername} with related data` : `Deleted employee ${employeeUsername}`,
            targetType: "Employee",
            targetId: employeeId,
            targetName: employeeUsername,
            metadata: { email: employeeEmail, deleteData, deletedData },
        });

        emitRealtimeToAdmins("employeeDeleted", {
            message: `Employee deleted: ${employeeUsername || employeeEmail || employeeId}`,
            employeeId,
            employeeEmail,
            employeeUsername,
            deletedData,
            createdAt: new Date(),
        });

        res.json({
            success: true,
            message: deleteData ? "Employee and related data deleted successfully" : "Employee deleted successfully. Old attendance records are kept.",
            deletedData,
        });
    } catch (error) {
        console.error("Delete employee error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to delete employee",
            error: error.message,
        });
    }
});

app.get("/api/users", verifyAdmin, async(req, res) => {
    try {
        const users = await User.find()
            .select("_id username email mobile")
            .sort({ username: 1 });

        res.json({
            success: true,
            data: users,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch employees",
        });
    }
});

app.get(
    "/api/personal-notifications/admin",
    verifyAdmin,
    async(req, res) => {
        try {
            const notifications = await PersonalNotification.find().sort({
                createdAt: -1,
            });

            res.json({
                success: true,
                data: notifications,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Failed to fetch personal notifications",
            });
        }
    }
);

app.get("/api/personal-notifications/me", verifyToken, async(req, res) => {
    try {
        const notifications = await PersonalNotification.find({
            employeeId: req.user.id,
        }).sort({ createdAt: -1 });

        res.json({
            success: true,
            data: notifications,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch your notifications",
        });
    }
});

app.post("/api/personal-notifications", verifyAdmin, async(req, res) => {
    try {
        const {
            employeeId,
            title,
            message,
            priority = "normal",
            sendEmail: shouldSendEmail = false,
            showPopup = true,
        } = req.body;

        if (!employeeId || !title || !message) {
            return res.status(400).json({
                success: false,
                message: "Employee, title and message are required",
            });
        }

        const employee = await User.findById(employeeId);

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const notification = await PersonalNotification.create({
            employeeId: employee._id,
            employeeName: employee.username,
            employeeUsername: employee.username,
            employeeEmail: employee.email,
            title,
            message,
            priority,
            sendEmail: Boolean(shouldSendEmail),
            showPopup: Boolean(showPopup),
            createdBy: req.admin.username || "Admin",
        });

        let emailMessage = "";

        if (shouldSendEmail) {
            if (!employee.email) {
                emailMessage =
                    " Notification saved, but the employee has no email.";
            } else if (!process.env.EMAIL_USER || !process.env.EMAIL_PASS) {
                emailMessage =
                    " Notification saved, but email is not configured in .env.";
            } else {
                await sendEmail({
                    to: employee.email,
                    subject: `Cargo Force: ${title}`,
                    text: `${title}\n\n${message}\n\nCargo Force Administration`,
                });

                emailMessage = " Email sent successfully.";
            }
        }

        await createAuditLog(req, {
            category: "Notifications",
            action: "CREATE_PERSONAL_NOTIFICATION",
            description: `Sent personal notification to ${employee.username}: ${title}`,
            targetType: "PersonalNotification",
            targetId: notification._id,
            targetName: title,
            metadata: { employeeId: employee._id, employeeUsername: employee.username, priority, sendEmail: Boolean(shouldSendEmail) },
        });

        emitRealtimeToAdmins("personalNotificationCreated", {
            message: `Personal notification sent to ${employee.username}`,
            notification,
            createdAt: new Date(),
        });

        emitRealtimeToEmployee([employee._id, employee.email, employee.username], "personalNotificationCreated", {
            message: title,
            notification,
            createdAt: new Date(),
        });

        res.status(201).json({
            success: true,
            message: `Personal notification sent successfully.${emailMessage}`,
            data: notification,
        });
    } catch (error) {
        console.error("Create personal notification error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to send personal notification",
        });
    }
});

app.patch(
    "/api/personal-notifications/:id/read",
    verifyToken,
    async(req, res) => {
        try {
            const notification = await PersonalNotification.findOneAndUpdate({
                _id: req.params.id,
                employeeId: req.user.id,
            }, {
                isRead: true,
                readAt: new Date(),
            }, { new: true });

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found",
                });
            }

            res.json({
                success: true,
                message: "Notification marked as read",
                data: notification,
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Failed to update notification",
            });
        }
    }
);

app.delete(
    "/api/personal-notifications/:id",
    verifyAdmin,
    async(req, res) => {
        try {
            const notification = await PersonalNotification.findByIdAndDelete(
                req.params.id
            );

            if (!notification) {
                return res.status(404).json({
                    success: false,
                    message: "Notification not found",
                });
            }

            await createAuditLog(req, {
                category: "Notifications",
                action: "DELETE_PERSONAL_NOTIFICATION",
                description: `Deleted personal notification: ${notification.title}`,
                targetType: "PersonalNotification",
                targetId: notification._id,
                targetName: notification.title,
                metadata: { employeeId: notification.employeeId, employeeUsername: notification.employeeUsername },
            });

            res.json({
                success: true,
                message: "Notification deleted successfully",
            });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: "Failed to delete notification",
            });
        }
    }
);

// ===========================
// MONTHLY SHIFT SCHEDULING
// ===========================

const isValidTime = (value) => {
    return value === "" || /^([01]\d|2[0-3]):[0-5]\d$/.test(value);
};

const getMonthDates = (year, month) => {
    const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();

    return Array.from({ length: daysInMonth }, (_, index) => {
        const day = index + 1;
        const dateObject = new Date(Date.UTC(year, month - 1, day));

        return {
            date: `${year}-${String(month).padStart(2, "0")}-${String(
                day
            ).padStart(2, "0")}`,
            dayOfWeek: dateObject.getUTCDay(),
        };
    });
};

app.get("/api/shift-schedules", verifyAdmin, async(req, res) => {
    try {
        const { employeeId, year, month } = req.query;

        if (!employeeId || !year || !month) {
            return res.status(400).json({
                success: false,
                message: "Employee, year and month are required",
            });
        }

        const schedules = await ShiftSchedule.find({
            employeeId,
            year: Number(year),
            month: Number(month),
        }).sort({ date: 1 });

        res.json({
            success: true,
            data: schedules,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch monthly shifts",
        });
    }
});

app.get("/api/shift-schedules/me", verifyToken, async(req, res) => {
    try {
        const { year, month, upcoming, startDate, endDate, limit } = req.query;
        const filter = {
            employeeId: req.user.id,
        };

        if (startDate || endDate) {
            filter.date = {};

            if (startDate) {
                filter.date.$gte = String(startDate);
            }

            if (endDate) {
                filter.date.$lte = String(endDate);
            }
        } else if (year && month) {
            filter.year = Number(year);
            filter.month = Number(month);
        } else if (upcoming === "true") {
            filter.date = {
                $gte: new Date().toISOString().slice(0, 10),
            };
        }

        const maxLimit = Math.min(Math.max(parseInt(limit, 10) || (upcoming === "true" ? 90 : 370), 1), 370);

        const schedules = await ShiftSchedule.find(filter)
            .sort({ date: 1 })
            .limit(maxLimit);

        res.json({
            success: true,
            data: schedules,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch your shifts",
        });
    }
});

app.post("/api/shift-schedules/bulk", verifyAdmin, async(req, res) => {
    try {
        const {
            employeeId,
            year,
            month,
            workingDays,
            startTime = "",
            breakStartTime = "",
            breakEndTime = "",
            endTime = "",
            notes = "",
        } = req.body;

        const numericYear = Number(year);
        const numericMonth = Number(month);
        const selectedDays = Array.isArray(workingDays) ? [...new Set(workingDays.map(Number))] : [];

        if (!employeeId ||
            !Number.isInteger(numericYear) ||
            !Number.isInteger(numericMonth) ||
            numericYear < 2000 ||
            numericYear > 2100 ||
            numericMonth < 1 ||
            numericMonth > 12
        ) {
            return res.status(400).json({
                success: false,
                message: "Valid employee, month and year are required",
            });
        }

        if (
            selectedDays.length === 0 ||
            selectedDays.some((day) => day < 0 || day > 6)
        ) {
            return res.status(400).json({
                success: false,
                message: "Select at least one valid working day",
            });
        }

        if (![startTime, breakStartTime, breakEndTime, endTime].every(
                isValidTime
            )) {
            return res.status(400).json({
                success: false,
                message: "Shift times must use HH:MM format",
            });
        }

        const employee = await User.findById(employeeId).select(
            "username email"
        );

        if (!employee) {
            return res.status(404).json({
                success: false,
                message: "Employee not found",
            });
        }

        const monthDates = getMonthDates(numericYear, numericMonth);
        const operations = monthDates.map(({ date, dayOfWeek }) => {
            const isWorkingDay = selectedDays.includes(dayOfWeek);

            return {
                updateOne: {
                    filter: {
                        employeeId: employee._id,
                        date,
                    },
                    update: {
                        $set: {
                            employeeUsername: employee.username,
                            employeeEmail: employee.email || "",
                            year: numericYear,
                            month: numericMonth,
                            dayOfWeek,
                            status: isWorkingDay ? "working" : "off",
                            startTime: isWorkingDay ? startTime : "",
                            breakStartTime: isWorkingDay ?
                                breakStartTime : "",
                            breakEndTime: isWorkingDay ? breakEndTime : "",
                            endTime: isWorkingDay ? endTime : "",
                            notes: isWorkingDay ? notes : "",
                            createdBy: req.admin.username || "Admin",
                        },
                        $setOnInsert: {
                            employeeId: employee._id,
                            date,
                        },
                    },
                    upsert: true,
                },
            };
        });

        await ShiftSchedule.bulkWrite(operations);

        const schedules = await ShiftSchedule.find({
            employeeId: employee._id,
            year: numericYear,
            month: numericMonth,
        }).sort({ date: 1 });

        await createAuditLog(req, {
            category: "Shifts",
            action: "BULK_UPDATE_MONTHLY_SHIFT",
            description: `Updated monthly shift for ${employee.username} (${numericMonth}/${numericYear})`,
            targetType: "ShiftSchedule",
            targetId: employee._id,
            targetName: employee.username,
            metadata: { employeeId: employee._id, year: numericYear, month: numericMonth, workingDays: selectedDays, startTime, endTime },
        });

        emitRealtimeToAdmins("shiftScheduleUpdated", {
            message: `${employee.username}'s monthly shift was updated`,
            employeeId: employee._id,
            username: employee.username,
            month: numericMonth,
            year: numericYear,
            createdAt: new Date(),
        });

        emitRealtimeToEmployee([employee._id, employee.email, employee.username], "myShiftUpdated", {
            message: "Your monthly shift schedule was updated",
            month: numericMonth,
            year: numericYear,
            createdAt: new Date(),
        });

        res.json({
            success: true,
            message: `${employee.username}'s full monthly shift was updated successfully`,
            data: schedules,
        });
    } catch (error) {
        console.error("Bulk shift update error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update monthly shift",
        });
    }
});


// ===========================
// DATE RANGE SHIFT ADD / UPDATE
// Admin can add/update past and future shifts for one or multiple employees
// ===========================

const isValidDateString = (value) => {
    return /^\d{4}-\d{2}-\d{2}$/.test(String(value || ""));
};

const getDatesBetween = (startDate, endDate) => {
    const dates = [];
    const start = new Date(`${startDate}T00:00:00.000Z`);
    const end = new Date(`${endDate}T00:00:00.000Z`);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        return dates;
    }

    if (start > end) {
        return dates;
    }

    const current = new Date(start);

    while (current <= end) {
        dates.push({
            date: current.toISOString().slice(0, 10),
            year: current.getUTCFullYear(),
            month: current.getUTCMonth() + 1,
            dayOfWeek: current.getUTCDay(),
        });

        current.setUTCDate(current.getUTCDate() + 1);
    }

    return dates;
};

app.post("/api/shift-schedules/range-bulk", verifyAdmin, async(req, res) => {
    try {
        const {
            employeeId,
            employeeIds,
            startDate,
            endDate,
            workingDays,
            status = "working",
            startTime = "",
            breakStartTime = "",
            breakEndTime = "",
            endTime = "",
            notes = "",
        } = req.body;

        const selectedEmployeeIds = Array.isArray(employeeIds) && employeeIds.length > 0 ?
            employeeIds.filter(Boolean) :
            employeeId ? [employeeId] : [];

        if (selectedEmployeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Select at least one employee",
            });
        }

        if (!isValidDateString(startDate) || !isValidDateString(endDate)) {
            return res.status(400).json({
                success: false,
                message: "Start date and end date must be in YYYY-MM-DD format",
            });
        }

        const dates = getDatesBetween(startDate, endDate);

        if (dates.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid date range",
            });
        }

        if (dates.length > 370) {
            return res.status(400).json({
                success: false,
                message: "Date range cannot be more than 370 days at once",
            });
        }

        if (!["working", "off", "leave", "holiday"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid shift status",
            });
        }

        if (![startTime, breakStartTime, breakEndTime, endTime].every(isValidTime)) {
            return res.status(400).json({
                success: false,
                message: "Shift times must use HH:MM format",
            });
        }

        const selectedWorkingDays = Array.isArray(workingDays) && workingDays.length > 0 ? [...new Set(workingDays.map(Number))] : [0, 1, 2, 3, 4, 5, 6];

        if (selectedWorkingDays.some((day) => !Number.isInteger(day) || day < 0 || day > 6)) {
            return res.status(400).json({
                success: false,
                message: "Working days must be between 0 and 6",
            });
        }

        const validEmployeeIds = selectedEmployeeIds.filter((id) =>
            mongoose.Types.ObjectId.isValid(String(id))
        );

        if (validEmployeeIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: "Invalid employee id",
            });
        }

        const employees = await User.find({
            _id: { $in: validEmployeeIds },
        }).select("_id username email");

        if (employees.length === 0) {
            return res.status(404).json({
                success: false,
                message: "No employees found",
            });
        }

        const operations = [];

        employees.forEach((employee) => {
            dates.forEach((dateInfo) => {
                const isSelectedDay = selectedWorkingDays.includes(dateInfo.dayOfWeek);
                const finalStatus = isSelectedDay ? status : "off";
                const isWorking = finalStatus === "working";

                operations.push({
                    updateOne: {
                        filter: {
                            employeeId: employee._id,
                            date: dateInfo.date,
                        },
                        update: {
                            $set: {
                                employeeUsername: employee.username,
                                employeeEmail: employee.email || "",
                                year: dateInfo.year,
                                month: dateInfo.month,
                                dayOfWeek: dateInfo.dayOfWeek,
                                status: finalStatus,
                                startTime: isWorking ? startTime : "",
                                breakStartTime: isWorking ? breakStartTime : "",
                                breakEndTime: isWorking ? breakEndTime : "",
                                endTime: isWorking ? endTime : "",
                                notes: isSelectedDay ? notes : "",
                                createdBy: req.admin.username || "Admin",
                            },
                            $setOnInsert: {
                                employeeId: employee._id,
                                date: dateInfo.date,
                            },
                        },
                        upsert: true,
                    },
                });
            });
        });

        const result = await ShiftSchedule.bulkWrite(operations);

        await createAuditLog(req, {
            category: "Shifts",
            action: "RANGE_BULK_SHIFT_UPDATE",
            description: `Updated shift range ${startDate} to ${endDate} for ${employees.length} employee(s)`,
            targetType: "ShiftSchedule",
            targetName: `${startDate} to ${endDate}`,
            metadata: {
                employeeIds: employees.map((employee) => String(employee._id)),
                startDate,
                endDate,
                workingDays: selectedWorkingDays,
                status,
                startTime,
                endTime,
                totalOperations: operations.length,
                matchedCount: result.matchedCount || 0,
                modifiedCount: result.modifiedCount || 0,
                upsertedCount: result.upsertedCount || 0,
            },
        });

        employees.forEach((employee) => {
            emitRealtimeToEmployee([employee._id, employee.email, employee.username], "myShiftUpdated", {
                message: "Your shift schedule was updated",
                startDate,
                endDate,
                createdAt: new Date(),
            });
        });

        emitRealtimeToAdmins("shiftScheduleUpdated", {
            message: `Shift range updated for ${employees.length} employee(s)`,
            startDate,
            endDate,
            employees: employees.map((employee) => ({
                _id: employee._id,
                username: employee.username,
                email: employee.email,
            })),
            createdAt: new Date(),
        });

        res.json({
            success: true,
            message: `Shift updated successfully from ${startDate} to ${endDate}`,
            stats: {
                employees: employees.length,
                dates: dates.length,
                totalOperations: operations.length,
                matchedCount: result.matchedCount || 0,
                modifiedCount: result.modifiedCount || 0,
                upsertedCount: result.upsertedCount || 0,
            },
        });
    } catch (error) {
        console.error("Range bulk shift update error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to update shift range",
            error: error.message,
        });
    }
});


app.put("/api/shift-schedules/:id", verifyAdmin, async(req, res) => {
    try {
        const {
            status,
            startTime = "",
            breakStartTime = "",
            breakEndTime = "",
            endTime = "",
            notes = "",
        } = req.body;

        if (!["working", "off", "leave", "holiday"].includes(status)) {
            return res.status(400).json({
                success: false,
                message: "Invalid shift status",
            });
        }

        if (![startTime, breakStartTime, breakEndTime, endTime].every(
                isValidTime
            )) {
            return res.status(400).json({
                success: false,
                message: "Shift times must use HH:MM format",
            });
        }

        const isWorking = status === "working";
        const schedule = await ShiftSchedule.findByIdAndUpdate(
            req.params.id, {
                status,
                startTime: isWorking ? startTime : "",
                breakStartTime: isWorking ? breakStartTime : "",
                breakEndTime: isWorking ? breakEndTime : "",
                endTime: isWorking ? endTime : "",
                notes,
                createdBy: req.admin.username || "Admin",
            }, {
                new: true,
                runValidators: true,
            }
        );

        if (!schedule) {
            return res.status(404).json({
                success: false,
                message: "Shift schedule not found",
            });
        }

        await createAuditLog(req, {
            category: "Shifts",
            action: "UPDATE_SHIFT_DATE",
            description: `Updated shift for ${schedule.employeeUsername} on ${schedule.date}`,
            targetType: "ShiftSchedule",
            targetId: schedule._id,
            targetName: schedule.employeeUsername,
            metadata: { date: schedule.date, status, startTime, endTime },
        });

        res.json({
            success: true,
            message: "Shift date updated successfully",
            data: schedule,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update shift date",
        });
    }
});

app.delete("/api/shift-schedules/month", verifyAdmin, async(req, res) => {
    try {
        const { employeeId, year, month } = req.query;

        if (!employeeId || !year || !month) {
            return res.status(400).json({
                success: false,
                message: "Employee, year and month are required",
            });
        }

        const result = await ShiftSchedule.deleteMany({
            employeeId,
            year: Number(year),
            month: Number(month),
        });

        await createAuditLog(req, {
            category: "Shifts",
            action: "DELETE_MONTHLY_SHIFT",
            description: `Deleted monthly shift records for employee ${employeeId} (${month}/${year})`,
            targetType: "ShiftSchedule",
            targetId: employeeId,
            targetName: String(employeeId),
            metadata: { employeeId, year, month, deletedCount: result.deletedCount || 0 },
        });

        res.json({
            success: true,
            message: `${result.deletedCount} monthly shift records deleted`,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to delete monthly shift",
        });
    }
});

app.get("/services", async(req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch services" });
    }
});

app.post("/api/scan/attendance", verifyAdmin, async(req, res) => {
    try {
        const { userId, scanType, qrVersion } = req.body;

        if (!userId || !scanType || !qrVersion) {
            return res.status(400).json({
                success: false,
                message: "Invalid QR data",
            });
        }

        const qrUser = await findUserByIdentifier(userId);

        if (!qrUser) {
            return res.status(400).json({
                success: false,
                message: "User not found",
            });
        }

        if (!qrUser.currentQrVersion) {
            qrUser.currentQrVersion = qrVersion;
            await qrUser.save();
        }

        if (qrUser.currentQrVersion !== qrVersion) {
            return res.status(400).json({
                success: false,
                message: "This QR is old. Please generate a new QR.",
            });
        }

        const identity = getEmployeeIdentity(qrUser);
        const employeeUserId = String(qrUser._id);

        const now = new Date();
        const today = now.toISOString().split("T")[0];

        let attendance = await Attendance.findOne({
            userId: employeeUserId,
            date: today,
        });

        if (!attendance) {
            attendance = new Attendance({
                userId: employeeUserId,
                date: today,
            });
        }

        attendance.userId = employeeUserId;
        attendance.name = identity.name;
        attendance.username = identity.username;
        attendance.email = identity.email;
        attendance.mobile = identity.mobile;

        let message = "";

        if (scanType === "ENTRY") {
            attendance.entryTime = now;
            message = "Entry time saved successfully";
        } else if (scanType === "BREAK_OUT") {
            attendance.breakOutTime = now;
            attendance.breakInTime = null;
            message = "Break out time saved successfully";
        } else if (scanType === "BREAK_IN") {
            attendance.breakInTime = now;

            if (attendance.breakOutTime) {
                const breakSeconds = Math.floor(
                    (attendance.breakInTime - attendance.breakOutTime) / 1000
                );

                attendance.totalBreakSeconds =
                    (attendance.totalBreakSeconds || 0) + Math.max(0, breakSeconds);
            }

            message = "Break in time saved successfully";
        } else if (scanType === "OUT") {
            attendance.lastOutTime = now;

            if (attendance.entryTime) {
                const totalSeconds = Math.floor(
                    (attendance.lastOutTime - attendance.entryTime) / 1000
                );

                attendance.totalWorkSeconds =
                    totalSeconds - (attendance.totalBreakSeconds || 0);

                if (attendance.totalWorkSeconds < 0) {
                    attendance.totalWorkSeconds = 0;
                }
            }

            message = "Out time saved successfully";
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid scan type",
            });
        }

        await attendance.save();

        emitRealtimeToAdmins("attendanceUpdated", {
            message,
            attendance,
            username: attendance.username || identity.username || "-",
            scanType,
            createdAt: new Date(),
        });

        emitRealtimeToEmployee([attendance.userId, attendance.email, attendance.username], "myAttendanceUpdated", {
            message,
            attendance,
            scanType,
            createdAt: new Date(),
        });

        await createAuditLog(req, {
            category: "Attendance",
            action: `SCAN_${scanType}`,
            description: `${message} for ${identity.username || identity.name || identity.email || employeeUserId}`,
            targetType: "Attendance",
            targetId: attendance._id,
            targetName: identity.username || identity.name || identity.email || String(employeeUserId),
            metadata: { scanType, userId: employeeUserId, date: attendance.date },
        });

        res.status(201).json({
            success: true,
            message,
            username: attendance.username || identity.username,
            data: attendance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to save attendance",
            error: error.message,
        });
    }
});

app.put("/api/scan/attendance/:id", verifyAdmin, async(req, res) => {
    try {
        const { entryTime, breakOutTime, breakInTime, lastOutTime } = req.body;

        const attendance = await Attendance.findById(req.params.id);

        if (!attendance) {
            return res.status(404).json({
                success: false,
                message: "Attendance record not found",
            });
        }

        attendance.entryTime = entryTime ? new Date(entryTime) : null;
        attendance.breakOutTime = breakOutTime ? new Date(breakOutTime) : null;
        attendance.breakInTime = breakInTime ? new Date(breakInTime) : null;
        attendance.lastOutTime = lastOutTime ? new Date(lastOutTime) : null;

        let totalBreakSeconds = 0;

        if (attendance.breakOutTime && attendance.breakInTime) {
            totalBreakSeconds = Math.floor(
                (attendance.breakInTime - attendance.breakOutTime) / 1000
            );

            if (totalBreakSeconds < 0) totalBreakSeconds = 0;
        }

        attendance.totalBreakSeconds = totalBreakSeconds;

        let totalWorkSeconds = 0;

        if (attendance.entryTime && attendance.lastOutTime) {
            totalWorkSeconds = Math.floor(
                (attendance.lastOutTime - attendance.entryTime) / 1000
            );

            totalWorkSeconds = totalWorkSeconds - totalBreakSeconds;

            if (totalWorkSeconds < 0) totalWorkSeconds = 0;
        }

        attendance.totalWorkSeconds = totalWorkSeconds;

        await attendance.save();

        emitRealtimeToAdmins("attendanceEdited", {
            message: "Attendance updated successfully",
            attendance,
            username: attendance.username || attendance.name || attendance.email || "-",
            createdAt: new Date(),
        });

        emitRealtimeToEmployee([attendance.userId, attendance.email, attendance.username], "myAttendanceUpdated", {
            message: "Your attendance was updated by admin",
            attendance,
            createdAt: new Date(),
        });

        await createAuditLog(req, {
            category: "Attendance",
            action: "UPDATE_ATTENDANCE",
            description: `Updated attendance for ${attendance.username || attendance.name || attendance.email || attendance.userId} on ${attendance.date || "selected date"}`,
            targetType: "Attendance",
            targetId: attendance._id,
            targetName: attendance.username || attendance.name || attendance.email || String(attendance.userId),
            metadata: { date: attendance.date, entryTime, breakOutTime, breakInTime, lastOutTime },
        });

        res.json({
            success: true,
            message: "Attendance updated successfully",
            data: attendance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to update attendance",
            error: error.message,
        });
    }
});

app.get("/api/scan/attendance", verifyAdmin, async(req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limitValue = parseInt(req.query.limit, 10) || 10;
        const limit = Math.min(Math.max(limitValue, 5), 100);
        const skip = (page - 1) * limit;

        const { startDate, endDate, search } = req.query;

        const filter = {};

        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                filter.createdAt.$gte = start;
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search && String(search).trim()) {
            const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safeSearch, "i");

            filter.$or = [
                { name: regex },
                { username: regex },
                { email: regex },
                { mobile: regex },
                { date: regex },
            ];
        }

        const [attendance, totalRecords] = await Promise.all([
            Attendance.find(filter)
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit),
            Attendance.countDocuments(filter),
        ]);

        const enrichedAttendance = await enrichAttendanceRecords(attendance);

        const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

        res.json({
            success: true,
            data: enrichedAttendance,
            pagination: {
                page,
                limit,
                totalRecords,
                totalPages,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
            },
            filters: {
                startDate: startDate || "",
                endDate: endDate || "",
                search: search || "",
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance",
            error: error.message,
        });
    }
});

app.get("/api/my/attendance", verifyToken, async(req, res) => {
    try {
        const userId = String(req.user.id || req.user._id || req.user.userId || "");
        const username = req.user.username || "";
        const email = req.user.email || "";

        const attendance = await Attendance.find({
            $or: [
                { userId },
                { username },
                { email },
            ],
        }).sort({ createdAt: -1 });

        const enrichedAttendance = await enrichAttendanceRecords(attendance);

        res.json({
            success: true,
            data: enrichedAttendance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch your attendance",
            error: error.message,
        });
    }
});


const getDateRange = (type) => {
    const now = new Date();
    const start = new Date(now);
    const end = new Date(now);

    if (type === "week") {
        const day = start.getDay();
        const diffToMonday = day === 0 ? -6 : 1 - day;
        start.setDate(start.getDate() + diffToMonday);
        start.setHours(0, 0, 0, 0);

        end.setTime(start.getTime());
        end.setDate(start.getDate() + 6);
        end.setHours(23, 59, 59, 999);
    } else {
        start.setDate(1);
        start.setHours(0, 0, 0, 0);

        end.setMonth(start.getMonth() + 1, 0);
        end.setHours(23, 59, 59, 999);
    }

    return { start, end };
};

const getRecordDateKey = (record) => {
    const dateValue = record.createdAt || record.entryTime || record.date;
    const date = new Date(dateValue);

    if (Number.isNaN(date.getTime())) {
        return "unknown-date";
    }

    return date.toISOString().slice(0, 10);
};

const buildEmployeeKey = (record) => {
    return String(record.userId || record.email || record.username || record._id || "unknown");
};

const summarizeAttendanceRecords = (records) => {
    const employeeMap = new Map();
    const presentDaySet = new Set();

    let totalWorkSeconds = 0;
    let totalBreakSeconds = 0;

    records.forEach((record) => {
        const workSeconds = Number(record.totalWorkSeconds) || 0;
        const breakSeconds = Number(record.totalBreakSeconds) || 0;
        const employeeKey = buildEmployeeKey(record);
        const dateKey = getRecordDateKey(record);

        totalWorkSeconds += workSeconds;
        totalBreakSeconds += breakSeconds;
        presentDaySet.add(`${employeeKey}-${dateKey}`);

        if (!employeeMap.has(employeeKey)) {
            employeeMap.set(employeeKey, {
                userId: employeeKey,
                name: record.name || record.username || "-",
                username: record.username || "-",
                email: record.email || "-",
                mobile: record.mobile || "-",
                records: 0,
                presentDays: new Set(),
                totalWorkSeconds: 0,
                totalBreakSeconds: 0,
            });
        }

        const employee = employeeMap.get(employeeKey);
        employee.records += 1;
        employee.presentDays.add(dateKey);
        employee.totalWorkSeconds += workSeconds;
        employee.totalBreakSeconds += breakSeconds;
    });

    const employeeSummaries = Array.from(employeeMap.values()).map((employee) => {
        const presentDays = employee.presentDays.size;
        const averageDailySeconds = presentDays > 0 ? Math.round(employee.totalWorkSeconds / presentDays) : 0;

        return {
            ...employee,
            presentDays,
            averageDailySeconds,
            presentDaysSet: undefined,
            presentDaysRaw: undefined,
            presentDaysList: Array.from(employee.presentDays),
            presentDays: employee.presentDays.size,
        };
    }).map(({ presentDays: _ignore, presentDaysList, ...employee }) => ({
        ...employee,
        presentDays: presentDaysList.length,
    }));

    return {
        records: records.length,
        totalWorkSeconds,
        totalBreakSeconds,
        presentDays: presentDaySet.size,
        averageDailySeconds: presentDaySet.size > 0 ? Math.round(totalWorkSeconds / presentDaySet.size) : 0,
        employeeSummaries: employeeSummaries.sort((a, b) => b.totalWorkSeconds - a.totalWorkSeconds),
    };
};

app.get("/api/attendance/summary", verifyAdmin, async(req, res) => {
    try {
        const weekRange = getDateRange("week");
        const monthRange = getDateRange("month");
        const todayStart = new Date();
        todayStart.setHours(0, 0, 0, 0);
        const todayEnd = new Date();
        todayEnd.setHours(23, 59, 59, 999);

        const search = String(req.query.search || "").trim();
        const searchFilter = {};

        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safeSearch, "i");

            searchFilter.$or = [
                { name: regex },
                { username: regex },
                { email: regex },
                { mobile: regex },
                { date: regex },
            ];
        }

        const [weekRecords, monthRecords, todayRecords] = await Promise.all([
            Attendance.find({
                ...searchFilter,
                createdAt: { $gte: weekRange.start, $lte: weekRange.end },
            }),
            Attendance.find({
                ...searchFilter,
                createdAt: { $gte: monthRange.start, $lte: monthRange.end },
            }),
            Attendance.find({
                ...searchFilter,
                createdAt: { $gte: todayStart, $lte: todayEnd },
            }),
        ]);

        const [enrichedWeekRecords, enrichedMonthRecords, enrichedTodayRecords] = await Promise.all([
            enrichAttendanceRecords(weekRecords),
            enrichAttendanceRecords(monthRecords),
            enrichAttendanceRecords(todayRecords),
        ]);

        const weekSummary = summarizeAttendanceRecords(enrichedWeekRecords);
        const monthSummary = summarizeAttendanceRecords(enrichedMonthRecords);
        const todayPresentEmployees = new Set(enrichedTodayRecords.map(buildEmployeeKey)).size;

        const employeeMap = new Map();

        monthSummary.employeeSummaries.forEach((employee) => {
            employeeMap.set(employee.userId, {
                userId: employee.userId,
                name: employee.name,
                username: employee.username,
                email: employee.email,
                mobile: employee.mobile,
                weekWorkSeconds: 0,
                weekBreakSeconds: 0,
                weekPresentDays: 0,
                monthWorkSeconds: employee.totalWorkSeconds,
                monthBreakSeconds: employee.totalBreakSeconds,
                monthPresentDays: employee.presentDays,
                monthAverageDailySeconds: employee.averageDailySeconds,
            });
        });

        weekSummary.employeeSummaries.forEach((employee) => {
            const current = employeeMap.get(employee.userId) || {
                userId: employee.userId,
                name: employee.name,
                username: employee.username,
                email: employee.email,
                mobile: employee.mobile,
                weekWorkSeconds: 0,
                weekBreakSeconds: 0,
                weekPresentDays: 0,
                monthWorkSeconds: 0,
                monthBreakSeconds: 0,
                monthPresentDays: 0,
                monthAverageDailySeconds: 0,
            };

            current.weekWorkSeconds = employee.totalWorkSeconds;
            current.weekBreakSeconds = employee.totalBreakSeconds;
            current.weekPresentDays = employee.presentDays;
            employeeMap.set(employee.userId, current);
        });

        res.json({
            success: true,
            data: {
                week: weekSummary,
                month: monthSummary,
                todayPresentEmployees,
                employeeSummaries: Array.from(employeeMap.values()).sort(
                    (a, b) => b.monthWorkSeconds - a.monthWorkSeconds
                ),
                ranges: {
                    weekStart: weekRange.start.toISOString(),
                    weekEnd: weekRange.end.toISOString(),
                    monthStart: monthRange.start.toISOString(),
                    monthEnd: monthRange.end.toISOString(),
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance summary",
            error: error.message,
        });
    }
});

app.get("/api/my/attendance/summary", verifyToken, async(req, res) => {
    try {
        const userId = String(req.user.id || req.user._id || req.user.userId || "");
        const username = req.user.username || "";
        const email = req.user.email || "";

        const userFilter = {
            $or: [
                { userId },
                { username },
                { email },
            ],
        };

        const weekRange = getDateRange("week");
        const monthRange = getDateRange("month");

        const [weekRecords, monthRecords] = await Promise.all([
            Attendance.find({
                ...userFilter,
                createdAt: { $gte: weekRange.start, $lte: weekRange.end },
            }),
            Attendance.find({
                ...userFilter,
                createdAt: { $gte: monthRange.start, $lte: monthRange.end },
            }),
        ]);

        const [enrichedWeekRecords, enrichedMonthRecords] = await Promise.all([
            enrichAttendanceRecords(weekRecords),
            enrichAttendanceRecords(monthRecords),
        ]);

        res.json({
            success: true,
            data: {
                week: summarizeAttendanceRecords(enrichedWeekRecords),
                month: summarizeAttendanceRecords(enrichedMonthRecords),
                ranges: {
                    weekStart: weekRange.start.toISOString(),
                    weekEnd: weekRange.end.toISOString(),
                    monthStart: monthRange.start.toISOString(),
                    monthEnd: monthRange.end.toISOString(),
                },
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch your attendance summary",
            error: error.message,
        });
    }
});


const getMonthBounds = (monthInput, yearInput) => {
    const now = new Date();
    const month = Number(monthInput) || now.getMonth() + 1;
    const year = Number(yearInput) || now.getFullYear();

    const start = new Date(year, month - 1, 1);
    start.setHours(0, 0, 0, 0);

    const end = new Date(year, month, 0);
    end.setHours(23, 59, 59, 999);

    const startKey = `${year}-${String(month).padStart(2, "0")}-01`;
    const endKey = `${year}-${String(month).padStart(2, "0")}-${String(end.getDate()).padStart(2, "0")}`;

    return { month, year, start, end, startKey, endKey };
};

const getDateKeyFromValue = (value) => {
    if (!value) return "";

    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return value;
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";

    return date.toISOString().slice(0, 10);
};

const combineDateAndTime = (dateKey, timeValue) => {
    if (!dateKey || !timeValue || !/^\d{2}:\d{2}$/.test(timeValue)) return null;

    const [hours, minutes] = timeValue.split(":").map(Number);
    const date = new Date(`${dateKey}T00:00:00`);

    if (Number.isNaN(date.getTime())) return null;

    date.setHours(hours, minutes, 0, 0);
    return date;
};

const secondsBetweenDates = (start, end) => {
    if (!start || !end) return 0;
    const seconds = Math.floor((end - start) / 1000);
    return seconds > 0 ? seconds : 0;
};

const getScheduledWorkSeconds = (schedule) => {
    const start = combineDateAndTime(schedule.date, schedule.startTime);
    const end = combineDateAndTime(schedule.date, schedule.endTime);

    if (!start || !end || end <= start) return 0;

    let breakSeconds = 0;
    const breakStart = combineDateAndTime(schedule.date, schedule.breakStartTime);
    const breakEnd = combineDateAndTime(schedule.date, schedule.breakEndTime);

    if (breakStart && breakEnd && breakEnd > breakStart) {
        breakSeconds = secondsBetweenDates(breakStart, breakEnd);
    }

    const scheduledSeconds = secondsBetweenDates(start, end) - breakSeconds;
    return scheduledSeconds > 0 ? scheduledSeconds : 0;
};

const createAttendanceKey = (employeeId, dateKey) => {
    return `${String(employeeId || "")}-${dateKey}`;
};

const buildAttendanceInsightPayload = ({ schedules, attendanceRecords, employeeSearch = "" }) => {
    const todayKey = new Date().toISOString().slice(0, 10);
    const graceMinutes = 10;
    const employeeMap = new Map();
    const attendanceMap = new Map();

    const ensureEmployee = (id, fallback = {}) => {
        const key = String(id || fallback.email || fallback.username || "unknown");

        if (!employeeMap.has(key)) {
            employeeMap.set(key, {
                userId: key,
                name: fallback.name || fallback.username || fallback.employeeUsername || "-",
                username: fallback.username || fallback.employeeUsername || "-",
                email: fallback.email || fallback.employeeEmail || "-",
                mobile: fallback.mobile || "-",
                scheduledDays: 0,
                presentDays: 0,
                absentDays: 0,
                lateDays: 0,
                overtimeDays: 0,
                totalLateSeconds: 0,
                totalOvertimeSeconds: 0,
                totalScheduledSeconds: 0,
                totalWorkedSeconds: 0,
            });
        }

        return employeeMap.get(key);
    };

    attendanceRecords.forEach((record) => {
        const dateKey = getDateKeyFromValue(record.date || record.entryTime || record.createdAt);
        const employeeId = String(record.userId || record.email || record.username || "unknown");

        if (dateKey) attendanceMap.set(createAttendanceKey(employeeId, dateKey), record);

        const employee = ensureEmployee(employeeId, record);
        if (record.entryTime) employee.presentDays += 1;
        employee.totalWorkedSeconds += Number(record.totalWorkSeconds) || 0;
    });

    const detailRows = [];

    schedules.forEach((schedule) => {
        const employeeId = String(schedule.employeeId || "unknown");
        const dateKey = schedule.date;
        const employee = ensureEmployee(employeeId, {
            employeeUsername: schedule.employeeUsername,
            employeeEmail: schedule.employeeEmail,
        });

        if (schedule.status !== "working") {
            detailRows.push({
                scheduleId: schedule._id,
                employeeId,
                name: employee.name,
                username: employee.username,
                email: employee.email,
                date: dateKey,
                status: schedule.status,
                scheduledStart: schedule.startTime || "",
                scheduledEnd: schedule.endTime || "",
                attendanceStatus: schedule.status,
                lateSeconds: 0,
                overtimeSeconds: 0,
                scheduledWorkSeconds: 0,
                actualWorkSeconds: 0,
            });
            return;
        }

        employee.scheduledDays += 1;

        const attendance = attendanceMap.get(createAttendanceKey(employeeId, dateKey));
        const scheduledStart = combineDateAndTime(dateKey, schedule.startTime);
        const scheduledWorkSeconds = getScheduledWorkSeconds(schedule);
        const actualWorkSeconds = Number((attendance && attendance.totalWorkSeconds)) || 0;

        employee.totalScheduledSeconds += scheduledWorkSeconds;

        let attendanceStatus = "scheduled";
        let lateSeconds = 0;
        let overtimeSeconds = 0;

        if ((attendance && attendance.entryTime)) {
            attendanceStatus = "present";

            if (scheduledStart) {
                const allowedStart = new Date(scheduledStart);
                allowedStart.setMinutes(allowedStart.getMinutes() + graceMinutes);

                if (new Date(attendance.entryTime) > allowedStart) {
                    lateSeconds = secondsBetweenDates(allowedStart, new Date(attendance.entryTime));
                    employee.lateDays += 1;
                    employee.totalLateSeconds += lateSeconds;
                    attendanceStatus = "late";
                }
            }

            if (scheduledWorkSeconds > 0 && actualWorkSeconds > scheduledWorkSeconds) {
                overtimeSeconds = actualWorkSeconds - scheduledWorkSeconds;
                employee.overtimeDays += 1;
                employee.totalOvertimeSeconds += overtimeSeconds;
            }
        } else if (dateKey <= todayKey) {
            attendanceStatus = "absent";
            employee.absentDays += 1;
        }

        detailRows.push({
            scheduleId: schedule._id,
            attendanceId: (attendance && attendance._id) || null,
            employeeId,
            name: employee.name,
            username: employee.username,
            email: employee.email,
            date: dateKey,
            status: schedule.status,
            scheduledStart: schedule.startTime || "",
            scheduledEnd: schedule.endTime || "",
            attendanceStatus,
            entryTime: (attendance && attendance.entryTime) || null,
            outTime: (attendance && attendance.lastOutTime) || null,
            lateSeconds,
            overtimeSeconds,
            scheduledWorkSeconds,
            actualWorkSeconds,
        });
    });

    let employeeSummaries = Array.from(employeeMap.values());

    if (employeeSearch) {
        const value = employeeSearch.toLowerCase();
        employeeSummaries = employeeSummaries.filter((employee) =>
            String(employee.name).toLowerCase().includes(value) ||
            String(employee.username).toLowerCase().includes(value) ||
            String(employee.email).toLowerCase().includes(value) ||
            String(employee.mobile).toLowerCase().includes(value)
        );
    }

    const totals = employeeSummaries.reduce(
        (acc, employee) => {
            acc.scheduledDays += employee.scheduledDays;
            acc.presentDays += employee.presentDays;
            acc.absentDays += employee.absentDays;
            acc.lateDays += employee.lateDays;
            acc.overtimeDays += employee.overtimeDays;
            acc.totalLateSeconds += employee.totalLateSeconds;
            acc.totalOvertimeSeconds += employee.totalOvertimeSeconds;
            acc.totalScheduledSeconds += employee.totalScheduledSeconds;
            acc.totalWorkedSeconds += employee.totalWorkedSeconds;
            return acc;
        }, {
            scheduledDays: 0,
            presentDays: 0,
            absentDays: 0,
            lateDays: 0,
            overtimeDays: 0,
            totalLateSeconds: 0,
            totalOvertimeSeconds: 0,
            totalScheduledSeconds: 0,
            totalWorkedSeconds: 0,
        }
    );

    return {
        graceMinutes,
        totals,
        employeeSummaries: employeeSummaries.sort((a, b) => b.absentDays + b.lateDays + b.overtimeDays - (a.absentDays + a.lateDays + a.overtimeDays)),
        details: detailRows.sort((a, b) => String(b.date).localeCompare(String(a.date))),
    };
};

app.get("/api/attendance/insights", verifyAdmin, async(req, res) => {
    try {
        const { month, year, start, end } = getMonthBounds(req.query.month, req.query.year);
        const search = String(req.query.search || "").trim();

        const scheduleFilter = { month, year };
        const attendanceFilter = { createdAt: { $gte: start, $lte: end } };

        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safeSearch, "i");
            attendanceFilter.$or = [
                { name: regex },
                { username: regex },
                { email: regex },
                { mobile: regex },
                { date: regex },
            ];
        }

        const [schedules, attendanceRecords] = await Promise.all([
            ShiftSchedule.find(scheduleFilter).sort({ date: 1 }),
            Attendance.find(attendanceFilter).sort({ createdAt: -1 }),
        ]);

        const payload = buildAttendanceInsightPayload({
            schedules,
            attendanceRecords,
            employeeSearch: search,
        });

        res.json({
            success: true,
            data: {
                month,
                year,
                ...payload,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance insights",
            error: error.message,
        });
    }
});

app.get("/api/my/attendance/insights", verifyToken, async(req, res) => {
    try {
        const userId = String(req.user.id || req.user._id || req.user.userId || "");
        const username = req.user.username || "";
        const email = req.user.email || "";
        const { month, year, start, end } = getMonthBounds(req.query.month, req.query.year);

        const [schedules, attendanceRecords] = await Promise.all([
            ShiftSchedule.find({ employeeId: userId, month, year }).sort({ date: 1 }),
            Attendance.find({
                createdAt: { $gte: start, $lte: end },
                $or: [{ userId }, { username }, { email }],
            }).sort({ createdAt: -1 }),
        ]);

        const payload = buildAttendanceInsightPayload({
            schedules,
            attendanceRecords,
        });

        res.json({
            success: true,
            data: {
                month,
                year,
                ...payload,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch your attendance insights",
            error: error.message,
        });
    }
});


const buildAnalyticsDateList = (start, end) => {
    const dates = [];
    const cursor = new Date(start);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= end) {
        const key = cursor.toISOString().slice(0, 10);
        dates.push({
            date: key,
            label: cursor.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
            }),
            records: 0,
            presentEmployees: 0,
            totalWorkSeconds: 0,
            totalBreakSeconds: 0,
            employeeSet: new Set(),
        });

        cursor.setDate(cursor.getDate() + 1);
    }

    return dates;
};

const getAnalyticsBounds = (startInput, endInput) => {
    const now = new Date();
    const end = endInput ? new Date(endInput) : new Date(now);
    const start = startInput ? new Date(startInput) : new Date(now);

    if (!startInput) start.setDate(start.getDate() - 29);

    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
        const fallbackEnd = new Date();
        fallbackEnd.setHours(23, 59, 59, 999);

        const fallbackStart = new Date();
        fallbackStart.setDate(fallbackStart.getDate() - 29);
        fallbackStart.setHours(0, 0, 0, 0);

        return { start: fallbackStart, end: fallbackEnd };
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);

    return { start, end };
};

app.get("/api/attendance/analytics", verifyAdmin, async(req, res) => {
    try {
        const { start, end } = getAnalyticsBounds(req.query.startDate, req.query.endDate);
        const startKey = start.toISOString().slice(0, 10);
        const endKey = end.toISOString().slice(0, 10);
        const search = String(req.query.search || "").trim();

        const attendanceFilter = {
            createdAt: { $gte: start, $lte: end },
        };

        if (search) {
            const safeSearch = search.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safeSearch, "i");
            attendanceFilter.$or = [
                { name: regex },
                { username: regex },
                { email: regex },
                { mobile: regex },
                { date: regex },
            ];
        }

        let [attendanceRecords, schedules, totalEmployees] = await Promise.all([
            Attendance.find(attendanceFilter).sort({ createdAt: 1 }).limit(20000),
            ShiftSchedule.find({ date: { $gte: startKey, $lte: endKey } }).sort({ date: 1 }),
            User.countDocuments(),
        ]);

        attendanceRecords = await enrichAttendanceRecords(attendanceRecords);

        const dailyTrends = buildAnalyticsDateList(start, end);
        const dailyMap = new Map(dailyTrends.map((day) => [day.date, day]));
        const employeeMap = new Map();
        const presentDaySet = new Set();

        attendanceRecords.forEach((record) => {
            const dateKey = getDateKeyFromValue(record.date || record.entryTime || record.createdAt);
            const employeeKey = buildEmployeeKey(record);
            const workSeconds = Number(record.totalWorkSeconds) || 0;
            const breakSeconds = Number(record.totalBreakSeconds) || 0;

            if (dailyMap.has(dateKey)) {
                const day = dailyMap.get(dateKey);
                day.records += 1;
                day.totalWorkSeconds += workSeconds;
                day.totalBreakSeconds += breakSeconds;
                day.employeeSet.add(employeeKey);
            }

            presentDaySet.add(`${employeeKey}-${dateKey}`);

            if (!employeeMap.has(employeeKey)) {
                employeeMap.set(employeeKey, {
                    userId: employeeKey,
                    name: record.name || record.username || "-",
                    username: record.username || "-",
                    email: record.email || "-",
                    mobile: record.mobile || "-",
                    records: 0,
                    presentDays: new Set(),
                    totalWorkSeconds: 0,
                    totalBreakSeconds: 0,
                });
            }

            const employee = employeeMap.get(employeeKey);
            employee.records += 1;
            employee.presentDays.add(dateKey);
            employee.totalWorkSeconds += workSeconds;
            employee.totalBreakSeconds += breakSeconds;
        });

        const cleanedDailyTrends = dailyTrends.map((day) => ({
            date: day.date,
            label: day.label,
            records: day.records,
            presentEmployees: day.employeeSet.size,
            totalWorkSeconds: day.totalWorkSeconds,
            totalBreakSeconds: day.totalBreakSeconds,
        }));

        const topEmployees = Array.from(employeeMap.values())
            .map((employee) => ({
                ...employee,
                presentDays: employee.presentDays.size,
                averageDailySeconds: employee.presentDays.size > 0 ? Math.round(employee.totalWorkSeconds / employee.presentDays.size) : 0,
            }))
            .sort((a, b) => b.totalWorkSeconds - a.totalWorkSeconds)
            .slice(0, 10);

        const insightPayload = buildAttendanceInsightPayload({
            schedules,
            attendanceRecords,
            employeeSearch: search,
        });

        const issueRows = (insightPayload.details || [])
            .filter((row) => ["late", "absent"].includes(row.attendanceStatus) ||
                Number(row.overtimeSeconds) > 0
            )
            .slice(0, 50);

        const totals = {
            records: attendanceRecords.length,
            totalEmployees,
            activeEmployees: employeeMap.size,
            presentDays: presentDaySet.size,
            totalWorkSeconds: attendanceRecords.reduce((sum, record) => sum + (Number(record.totalWorkSeconds) || 0), 0),
            totalBreakSeconds: attendanceRecords.reduce((sum, record) => sum + (Number(record.totalBreakSeconds) || 0), 0),
        };

        totals.averageDailySeconds = totals.presentDays > 0 ? Math.round(totals.totalWorkSeconds / totals.presentDays) : 0;

        res.json({
            success: true,
            data: {
                range: {
                    startDate: startKey,
                    endDate: endKey,
                    search,
                },
                totals,
                dailyTrends: cleanedDailyTrends,
                topEmployees,
                statusDistribution: {
                    presentDays: insightPayload.totals.presentDays || 0,
                    lateDays: insightPayload.totals.lateDays || 0,
                    absentDays: insightPayload.totals.absentDays || 0,
                    overtimeDays: insightPayload.totals.overtimeDays || 0,
                    totalLateSeconds: insightPayload.totals.totalLateSeconds || 0,
                    totalOvertimeSeconds: insightPayload.totals.totalOvertimeSeconds || 0,
                },
                recentStatusRows: issueRows,
            },
        });
    } catch (error) {
        console.error("Analytics error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance analytics",
            error: error.message,
        });
    }
});


app.get("/api/attendance/export-all", verifyAdmin, async(req, res) => {
    try {
        const { startDate, endDate, search } = req.query;
        const filter = {};

        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                filter.createdAt.$gte = start;
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search && String(search).trim()) {
            const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safeSearch, "i");

            filter.$or = [
                { name: regex },
                { username: regex },
                { email: regex },
                { mobile: regex },
                { date: regex },
            ];
        }

        const records = await Attendance.find(filter)
            .sort({ createdAt: -1 })
            .limit(10000);

        const employeeMap = records.reduce((acc, item) => {
            const key = String(item.userId || item.email || item.username || "unknown");

            if (!acc[key]) {
                acc[key] = {
                    userId: key,
                    name: item.name || item.username || "-",
                    username: item.username || "-",
                    email: item.email || "-",
                    mobile: item.mobile || "-",
                    records: 0,
                    totalWorkSeconds: 0,
                    totalBreakSeconds: 0,
                };
            }

            acc[key].records += 1;
            acc[key].totalWorkSeconds += Number(item.totalWorkSeconds || 0);
            acc[key].totalBreakSeconds += Number(item.totalBreakSeconds || 0);
            return acc;
        }, {});

        await createAuditLog(req, {
            category: "Exports",
            action: "EXPORT_ALL_ATTENDANCE",
            description: `Exported all attendance records (${records.length} records)`,
            targetType: "Attendance",
            targetName: "All Employees Export",
            metadata: { totalRecords: records.length, totalEmployees: Object.keys(employeeMap).length, startDate: startDate || "", endDate: endDate || "", search: search || "" },
        });

        res.json({
            success: true,
            data: records,
            summary: Object.values(employeeMap),
            meta: {
                totalRecords: records.length,
                totalEmployees: Object.keys(employeeMap).length,
                startDate: startDate || "",
                endDate: endDate || "",
                search: search || "",
                maxLimit: 10000,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to export attendance records",
            error: error.message,
        });
    }
});


// ===========================
// AUDIT LOG / ACTIVITY HISTORY
// ===========================

app.get("/api/admin/activity-logs", verifyAdmin, async(req, res) => {
    try {
        const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
        const limitValue = parseInt(req.query.limit, 10) || 20;
        const limit = Math.min(Math.max(limitValue, 5), 100);
        const skip = (page - 1) * limit;
        const { search, category, action, startDate, endDate } = req.query;

        const filter = {};

        if (category && String(category).trim() && category !== "All") {
            filter.category = String(category).trim();
        }

        if (action && String(action).trim() && action !== "All") {
            filter.action = String(action).trim();
        }

        if (startDate || endDate) {
            filter.createdAt = {};

            if (startDate) {
                const start = new Date(startDate);
                start.setHours(0, 0, 0, 0);
                filter.createdAt.$gte = start;
            }

            if (endDate) {
                const end = new Date(endDate);
                end.setHours(23, 59, 59, 999);
                filter.createdAt.$lte = end;
            }
        }

        if (search && String(search).trim()) {
            const safeSearch = String(search).trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            const regex = new RegExp(safeSearch, "i");

            filter.$or = [
                { category: regex },
                { action: regex },
                { adminUsername: regex },
                { description: regex },
                { targetType: regex },
                { targetName: regex },
            ];
        }

        const [logs, totalRecords, categories, actions] = await Promise.all([
            AuditLog.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
            AuditLog.countDocuments(filter),
            AuditLog.distinct("category"),
            AuditLog.distinct("action"),
        ]);

        const totalPages = Math.max(Math.ceil(totalRecords / limit), 1);

        res.json({
            success: true,
            data: logs,
            categories: categories.filter(Boolean).sort(),
            actions: actions.filter(Boolean).sort(),
            pagination: {
                page,
                limit,
                totalRecords,
                totalPages,
                hasPrevPage: page > 1,
                hasNextPage: page < totalPages,
            },
        });
    } catch (error) {
        console.error("Fetch activity logs error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to fetch activity logs",
            error: error.message,
        });
    }
});

app.delete("/api/admin/activity-logs", verifyAdmin, async(req, res) => {
    try {
        const beforeDate = req.query.beforeDate;
        const filter = {};

        if (beforeDate) {
            const date = new Date(beforeDate);
            date.setHours(23, 59, 59, 999);
            filter.createdAt = { $lte: date };
        }

        const result = await AuditLog.deleteMany(filter);

        await createAuditLog(req, {
            category: "Audit Log",
            action: "CLEAR_ACTIVITY_LOGS",
            description: beforeDate ? `Cleared activity logs before ${beforeDate}` : "Cleared all activity logs",
            targetType: "AuditLog",
            targetName: "Activity Logs",
            metadata: { beforeDate: beforeDate || "", deletedCount: result.deletedCount || 0 },
        });

        res.json({
            success: true,
            message: `${result.deletedCount || 0} activity logs deleted`,
            deletedCount: result.deletedCount || 0,
        });
    } catch (error) {
        console.error("Clear activity logs error:", error);
        res.status(500).json({
            success: false,
            message: "Failed to clear activity logs",
            error: error.message,
        });
    }
});

app.get("/api/health", (req, res) => {
    res.json({
        success: true,
        message: "Server is healthy",
        time: new Date().toISOString(),
    });
});

app.get("/", (req, res) => {
    res.send("Server is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});