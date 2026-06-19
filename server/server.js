require("dotenv").config();

const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
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
    try {
        const filePath = path.join(__dirname, "admins.json");
        const data = fs.readFileSync(filePath, "utf-8");
        return JSON.parse(data);
    } catch (error) {
        console.error("Error reading admins.json:", error.message);
        return [];
    }
};

const generateQRVersion = () => {
    return `QR-${Date.now()}-${Math.random().toString(36).substring(2, 10)}`;
};

const userSchema = new mongoose.Schema({
    username: String,
    email: String,
    mobile: String,
    password: String,
    currentQrVersion: {
        type: String,
        default: "",
    },
});

const User = mongoose.model("User", userSchema);

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

app.post("/register", async(req, res) => {
    try {
        const { username, email, mobile, password } = req.body;

        if (!username || !email || !password) {
            return res.status(400).json({ error: "All fields required" });
        }

        const existingUser = await User.findOne({ email });

        if (existingUser) {
            return res.status(400).json({ error: "Email already registered" });
        }

        const hashedPassword = await bcrypt.hash(password, 10);

        const firstQrVersion = generateQRVersion();

        const newUser = new User({
            username,
            email,
            mobile,
            password: hashedPassword,
            currentQrVersion: firstQrVersion,
        });

        await newUser.save();

        res.status(201).json({
            message: "User registered successfully",
        });
    } catch (error) {
        res.status(500).json({
            error: "Registration failed",
        });
    }
});

app.post("/login", async(req, res) => {
    try {
        const { email, password } = req.body;

        let user = await User.findOne({ email });

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

app.get("/services", async(req, res) => {
    try {
        const services = await Service.find();
        res.json(services);
    } catch (error) {
        res.status(500).json({ error: "Failed to fetch services" });
    }
});

app.post("/api/scan/attendance", async(req, res) => {
    try {
        const { userId, name, username, email, mobile, scanType, qrVersion } =
        req.body;

        if (!userId || !scanType || !qrVersion) {
            return res.status(400).json({
                success: false,
                message: "Invalid QR data",
            });
        }

        const qrUser = await User.findById(userId);

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

        const now = new Date();
        const today = now.toISOString().split("T")[0];

        let attendance = await Attendance.findOne({
            userId,
            date: today,
        });

        if (!attendance) {
            attendance = new Attendance({
                userId,
                name,
                username,
                email,
                mobile,
                date: today,
            });
        }

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

        res.status(201).json({
            success: true,
            message,
            username,
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

app.put("/api/scan/attendance/:id", async(req, res) => {
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

app.get("/api/scan/attendance", async(req, res) => {
    try {
        const attendance = await Attendance.find().sort({ createdAt: -1 });

        res.json({
            success: true,
            data: attendance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to fetch attendance",
            error: error.message,
        });
    }
});

app.get("/", (req, res) => {
    res.send("Server is running");
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});