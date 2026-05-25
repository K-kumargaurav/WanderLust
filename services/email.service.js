const nodemailer = require("nodemailer");
const config = require("../config");

// ─── Singleton transport (created once on require) ───────────────────────────
const transport = nodemailer.createTransport({
    host: config.smtp.host,
    port: config.smtp.port,
    secure: false,
    auth: {
        user: config.smtp.user,
        pass: config.smtp.pass,
    },
});

const fromAddress = `"WanderLust" <${config.smtp.user || "noreply@wanderlust.com"}>`;

/**
 * Sends a password reset email with a tokenized link.
 * @param {string} toEmail       - Recipient email address
 * @param {string} rawToken      - Unhashed reset token (goes in the URL)
 * @param {string} host          - Request host header (e.g. 'localhost:8080')
 * @returns {Promise<void>}
 */
async function sendPasswordResetEmail(toEmail, rawToken, host) {
    const protocol = config.server.isProduction ? "https" : "http";
    const resetUrl = `${protocol}://${host}/reset/${rawToken}`;

    await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: "WanderLust — Password Reset",
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2>Password Reset</h2>
                <p>You requested a password reset for your WanderLust account.</p>
                <p><a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#C0602A;color:white;text-decoration:none;border-radius:8px">Reset Password</a></p>
                <p style="color:#888;font-size:0.85rem">This link expires in 1 hour. If you didn't request this, ignore this email.</p>
            </div>
        `,
    });
}

/**
 * Sends a booking confirmation email to the guest.
 * @param {string} toEmail   - Guest's email address
 * @param {object} booking   - Booking object with populated listing
 * @param {string} host      - Request host header
 * @returns {Promise<void>}
 */
async function sendBookingConfirmationEmail(toEmail, booking, host) {
    const protocol = config.server.isProduction ? "https" : "http";
    const bookingsUrl = `${protocol}://${host}/bookings`;

    const checkIn = new Date(booking.checkIn).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });
    const checkOut = new Date(booking.checkOut).toLocaleDateString("en-IN", {
        weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    const nights = Math.ceil(
        (new Date(booking.checkOut) - new Date(booking.checkIn)) / (1000 * 60 * 60 * 24)
    );

    const listing = booking.listing;

    await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject: `WanderLust — Booking Confirmed: ${listing.title}`,
        html: `
            <div style="font-family:sans-serif;max-width:480px;margin:0 auto">
                <h2>Booking Confirmed!</h2>
                <p>Your booking at <strong>${listing.title}</strong> in ${listing.location} has been confirmed.</p>
                <table style="width:100%;border-collapse:collapse;margin:16px 0">
                    <tr>
                        <td style="padding:8px 0;color:#888">Check-in</td>
                        <td style="padding:8px 0;text-align:right">${checkIn}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#888">Check-out</td>
                        <td style="padding:8px 0;text-align:right">${checkOut}</td>
                    </tr>
                    <tr>
                        <td style="padding:8px 0;color:#888">Nights</td>
                        <td style="padding:8px 0;text-align:right">${nights}</td>
                    </tr>
                    <tr style="border-top:1px solid #eee">
                        <td style="padding:8px 0;font-weight:bold">Total</td>
                        <td style="padding:8px 0;text-align:right;font-weight:bold">\u20B9${booking.totalPrice.toLocaleString("en-IN")}</td>
                    </tr>
                </table>
                <p><a href="${bookingsUrl}" style="display:inline-block;padding:12px 24px;background:#C0602A;color:white;text-decoration:none;border-radius:8px">View Your Bookings</a></p>
                <p style="color:#888;font-size:0.85rem">Thank you for choosing WanderLust!</p>
            </div>
        `,
    });
}

module.exports = {
    sendPasswordResetEmail,
    sendBookingConfirmationEmail,
};
