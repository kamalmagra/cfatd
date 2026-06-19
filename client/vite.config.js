import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";

export default defineConfig({
    plugins: [react()],

    server: {
        host: true,
        port: 5173,

        proxy: {
            "/api": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },

            "/login": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },

            "/register": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },

            "/admin-login": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },

            "/book": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },

            "/bookings": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },

            "/user-bookings": {
                target: "http://localhost:5000",
                changeOrigin: true,
                secure: false,
            },
        },
    },

    build: {
        outDir: "dist",
    },

    base: "/",
});