import express from "express";
import Attendance from "../models/Attendance.js";

const router = express.Router();

router.post("/attendance", async(req, res) => {
    try {
        const { userId, name, username, email, mobile, scanType } = req.body;

        if (!userId || !scanType) {
            return res.status(400).json({
                success: false,
                message: "User ID and scan type are required",
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

        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        if (attendance.lastScanTime && attendance.lastScanTime >= tenMinutesAgo) {
            return res.status(400).json({
                success: false,
                message: "Already scanned. Please wait 10 minutes before scanning again.",
            });
        }

        let message = "";

        if (scanType === "ENTRY_LASTOUT") {
            if (!attendance.entryTime) {
                attendance.entryTime = now;
                message = "Entry time saved successfully";
            } else {
                attendance.lastOutTime = now;

                const totalSeconds = Math.floor(
                    (attendance.lastOutTime - attendance.entryTime) / 1000
                );

                attendance.totalWorkSeconds =
                    totalSeconds - (attendance.totalBreakSeconds || 0);

                if (attendance.totalWorkSeconds < 0) {
                    attendance.totalWorkSeconds = 0;
                }

                message = "Last out time saved successfully";
            }
        } else if (scanType === "BREAK") {
            if (!attendance.breakOutTime || attendance.breakInTime) {
                attendance.breakOutTime = now;
                attendance.breakInTime = null;
                message = "Break out time saved successfully";
            } else {
                attendance.breakInTime = now;

                const breakSeconds = Math.floor(
                    (attendance.breakInTime - attendance.breakOutTime) / 1000
                );

                attendance.totalBreakSeconds =
                    (attendance.totalBreakSeconds || 0) + breakSeconds;

                message = "Break in time saved successfully";
            }
        } else {
            return res.status(400).json({
                success: false,
                message: "Invalid scan type",
            });
        }

        attendance.lastScanTime = now;
        attendance.lastScanType = scanType;

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

router.get("/attendance", async(req, res) => {
    try {
        const attendance = await Attendance.find().sort({ createdAt: -1 });

        res.status(200).json({
            success: true,
            data: attendance,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: "Failed to get attendance data",
            error: error.message,
        });
    }
});

export default router;