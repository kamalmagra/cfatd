import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
    },
    name: {
        type: String,
        default: "",
    },
    username: {
        type: String,
        default: "",
    },
    mobile: {
        type: String,
        default: "",
    },
    scanType: {
        type: String,
        required: true,
    },
    action: {
        type: String,
        required: true,
    },
    scanTime: {
        type: Date,
        default: Date.now,
    },
}, { timestamps: true });

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;