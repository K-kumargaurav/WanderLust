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

// ─── Private helpers ─────────────────────────────────────────────────────────

function getBaseUrl() {
    const protocol = config.server.isProduction ? "https" : "http";
    const port = config.server.isProduction ? "" : `:${config.server.port}`;
    const host = config.server.isProduction
        ? process.env.HOST || "localhost"
        : "localhost";
    return `${protocol}://${host}${port}`;
}

/**
 * Builds a consistent branded HTML email template.
 * @param {object} options
 * @param {string} options.title       - Email heading
 * @param {string} options.body        - Main HTML content
 * @param {string} options.buttonText  - CTA button label
 * @param {string} options.buttonUrl   - CTA button URL
 * @param {string} [options.footerNote]- Optional small footer note
 */
function buildEmailHtml({ title, body, buttonText, buttonUrl, footerNote }) {
    return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
      <title>${title}</title>
    </head>
    <body style="margin:0;padding:0;background:#FAF7F2;
                 font-family:'DM Sans',Arial,sans-serif">
      <table width="100%" cellpadding="0" cellspacing="0"
             style="background:#FAF7F2;padding:40px 20px">
        <tr>
          <td align="center">
            <table width="560" cellpadding="0" cellspacing="0"
                   style="background:#FFFFFF;border-radius:16px;
                          overflow:hidden;box-shadow:0 4px 20px
                          rgba(0,0,0,0.08)">

              <!-- Header -->
              <tr>
                <td style="background:#C0602A;padding:28px 40px;
                           text-align:center">
                  <span style="font-family:Georgia,serif;font-size:24px;
                               font-weight:400;color:#FFFFFF;
                               letter-spacing:-0.02em">
                    WanderLust
                  </span>
                </td>
              </tr>

              <!-- Body -->
              <tr>
                <td style="padding:40px 40px 32px">
                  <h1 style="font-family:Georgia,serif;font-size:26px;
                             font-weight:400;color:#1C1C1C;margin:0 0
                             16px;letter-spacing:-0.02em">
                    ${title}
                  </h1>
                  <div style="font-size:15px;color:#555;line-height:1.7">
                    ${body}
                  </div>
                  ${buttonText && buttonUrl ? `
                  <div style="margin-top:32px">
                    <a href="${buttonUrl}"
                       style="display:inline-block;padding:14px 28px;
                              background:#C0602A;color:#FFFFFF;
                              text-decoration:none;border-radius:8px;
                              font-size:15px;font-weight:600">
                      ${buttonText}
                    </a>
                  </div>` : ""}
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background:#F2EDE4;padding:20px 40px;
                           border-top:1px solid #EDE8DF">
                  <p style="margin:0;font-size:12px;color:#B8A99A;
                            line-height:1.6">
                    ${footerNote ||
                      "You received this email because you have an account on WanderLust. " +
                      "If you did not expect this email, please ignore it."}
                  </p>
                </td>
              </tr>

            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `;
}

function buildDetailRow(label, value) {
    return `
    <tr>
      <td style="padding:8px 0;color:#888;font-size:14px;
                 width:140px">${label}</td>
      <td style="padding:8px 0;color:#1C1C1C;font-size:14px;
                 font-weight:600">${value}</td>
    </tr>`;
}

function formatDateReadable(date) {
    return new Date(date).toLocaleDateString("en-IN", {
        weekday: "short",
        day: "numeric",
        month: "long",
        year: "numeric",
    });
}

function formatINR(amount) {
    return "\u20B9" + Number(amount).toLocaleString("en-IN");
}

// ─── Password Reset (unchanged) ─────────────────────────────────────────────

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

// ─── 1. Booking Request → Guest ─────────────────────────────────────────────

/**
 * Sent to guest immediately when they submit a booking.
 * Confirms we received their request and payment is pending.
 *
 * @param {string} guestEmail
 * @param {object} booking - populated with listing
 */
async function sendBookingRequestToGuest(guestEmail, booking) {
    const base = getBaseUrl();
    const listing = booking.listing;
    const subject = `Your booking request for ${listing.title}`;

    const detailTable = `
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${buildDetailRow("Listing", listing.title)}
      ${buildDetailRow("Location", `${listing.location}, ${listing.country}`)}
      ${buildDetailRow("Check-in", formatDateReadable(booking.checkIn))}
      ${buildDetailRow("Check-out", formatDateReadable(booking.checkOut))}
      ${buildDetailRow("Duration", `${booking.nights} night(s)`)}
      ${buildDetailRow("Subtotal", formatINR(booking.subtotal))}
      ${buildDetailRow("GST (18%)", formatINR(booking.gstAmount))}
      ${buildDetailRow("Total", `<strong>${formatINR(booking.totalPrice)}</strong>`)}
    </table>`;

    const body = `
    <p>We've received your booking request. Complete payment to confirm your stay.</p>
    ${detailTable}`;

    const html = buildEmailHtml({
        title: subject,
        body,
        buttonText: "Complete Payment",
        buttonUrl: `${base}/bookings`,
    });

    await transport.sendMail({ from: fromAddress, to: guestEmail, subject, html });
    console.log(`[email] Sent: ${subject} → ${guestEmail}`);
}

// ─── 2. Booking Notification → Host ─────────────────────────────────────────

/**
 * Sent to the listing owner when a guest makes a booking.
 *
 * @param {string} hostEmail
 * @param {object} booking - populated with listing and guest
 */
async function sendBookingNotificationToHost(hostEmail, booking) {
    const base = getBaseUrl();
    const listing = booking.listing;
    const subject = `New booking on your listing: ${listing.title}`;

    const detailTable = `
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${buildDetailRow("Guest", booking.guest.username)}
      ${buildDetailRow("Listing", listing.title)}
      ${buildDetailRow("Check-in", formatDateReadable(booking.checkIn))}
      ${buildDetailRow("Check-out", formatDateReadable(booking.checkOut))}
      ${buildDetailRow("Duration", `${booking.nights} night(s)`)}
      ${buildDetailRow("Total", `<strong>${formatINR(booking.totalPrice)}</strong>`)}
    </table>`;

    const body = `
    <p><strong>${booking.guest.username}</strong> has booked your listing.</p>
    ${detailTable}`;

    const html = buildEmailHtml({
        title: subject,
        body,
        buttonText: "View Booking",
        buttonUrl: `${base}/host/bookings`,
    });

    await transport.sendMail({ from: fromAddress, to: hostEmail, subject, html });
    console.log(`[email] Sent: ${subject} → ${hostEmail}`);
}

// ─── 3. Booking Confirmed → Guest ──────────────────────────────────────────

/**
 * Sent to guest when payment is confirmed (Stripe webhook fires).
 * Replaces the old sendBookingConfirmationEmail.
 *
 * @param {string} guestEmail
 * @param {object} booking - populated with listing
 */
async function sendBookingConfirmedToGuest(guestEmail, booking) {
    const base = getBaseUrl();
    const listing = booking.listing;
    const subject = `Booking confirmed — ${listing.title}`;

    const detailTable = `
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${buildDetailRow("Listing", listing.title)}
      ${buildDetailRow("Location", `${listing.location}, ${listing.country}`)}
      ${buildDetailRow("Check-in", formatDateReadable(booking.checkIn))}
      ${buildDetailRow("Check-out", formatDateReadable(booking.checkOut))}
      ${buildDetailRow("Duration", `${booking.nights} night(s)`)}
      ${buildDetailRow("Subtotal", formatINR(booking.subtotal))}
      ${buildDetailRow("GST (18%)", formatINR(booking.gstAmount))}
      ${buildDetailRow("Total", `<strong>${formatINR(booking.totalPrice)}</strong>`)}
      ${buildDetailRow("Payment", '<span style="color:#2E7D32;font-weight:700">✓ Paid</span>')}
    </table>`;

    const body = `
    <div style="text-align:center;margin-bottom:24px">
      <span style="display:inline-block;width:56px;height:56px;
                   line-height:56px;border-radius:50%;background:#E8F5E9;
                   font-size:28px;color:#2E7D32">✓</span>
    </div>
    <p>Your payment was successful and your booking is confirmed.</p>
    ${detailTable}
    <p style="color:#888;font-size:13px;margin-top:16px">
      The host will reach out with check-in details closer to your stay.
    </p>`;

    const html = buildEmailHtml({
        title: subject,
        body,
        buttonText: "View My Bookings",
        buttonUrl: `${base}/bookings`,
    });

    await transport.sendMail({ from: fromAddress, to: guestEmail, subject, html });
    console.log(`[email] Sent: ${subject} → ${guestEmail}`);
}

// ─── 4. Booking Cancelled → Guest ──────────────────────────────────────────

/**
 * Sent to guest when booking is cancelled/rejected.
 * Includes refund notice if payment was made.
 *
 * @param {string} guestEmail
 * @param {object} booking - populated with listing
 * @param {string} reason  - 'rejected' | 'cancelled'
 */
async function sendBookingCancelledToGuest(guestEmail, booking, reason) {
    const base = getBaseUrl();
    const listing = booking.listing;

    const subject =
        reason === "rejected"
            ? `Your booking was declined — ${listing.title}`
            : `Booking cancellation confirmed — ${listing.title}`;

    const detailTable = `
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${buildDetailRow("Listing", listing.title)}
      ${buildDetailRow("Location", `${listing.location}, ${listing.country}`)}
      ${buildDetailRow("Check-in", formatDateReadable(booking.checkIn))}
      ${buildDetailRow("Check-out", formatDateReadable(booking.checkOut))}
      ${buildDetailRow("Duration", `${booking.nights} night(s)`)}
      ${buildDetailRow("Total", `<strong>${formatINR(booking.totalPrice)}</strong>`)}
    </table>`;

    let body;
    if (reason === "rejected") {
        body = `
        <p>Unfortunately the host has declined your booking request.</p>
        <p>A full refund of <strong>${formatINR(booking.totalPrice)}</strong> has been
           initiated and will appear in 5–10 business days.</p>
        ${detailTable}`;
    } else {
        body = `
        <p>Your booking has been cancelled as requested.</p>
        ${booking.paymentStatus === "paid"
            ? `<p>A full refund of <strong>${formatINR(booking.totalPrice)}</strong> has been
                  initiated and will appear in 5–10 business days.</p>`
            : ""}
        ${detailTable}`;
    }

    const html = buildEmailHtml({
        title: subject,
        body,
        buttonText: "Browse Other Listings",
        buttonUrl: `${base}/listings`,
    });

    await transport.sendMail({ from: fromAddress, to: guestEmail, subject, html });
    console.log(`[email] Sent: ${subject} → ${guestEmail}`);
}

// ─── 5. Cancellation Notification → Host ────────────────────────────────────

/**
 * Sent to host when a guest cancels their booking.
 *
 * @param {string} hostEmail
 * @param {object} booking - populated with listing and guest
 */
async function sendCancellationNotificationToHost(hostEmail, booking) {
    const base = getBaseUrl();
    const listing = booking.listing;
    const subject = `Booking cancelled — ${listing.title}`;

    const detailTable = `
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${buildDetailRow("Guest", booking.guest.username)}
      ${buildDetailRow("Listing", listing.title)}
      ${buildDetailRow("Check-in", formatDateReadable(booking.checkIn))}
      ${buildDetailRow("Check-out", formatDateReadable(booking.checkOut))}
      ${buildDetailRow("Duration", `${booking.nights} night(s)`)}
    </table>`;

    const body = `
    <p><strong>${booking.guest.username}</strong> has cancelled their booking.</p>
    ${detailTable}
    <p style="color:#888;font-size:13px">These dates are now available for new bookings.</p>`;

    const html = buildEmailHtml({
        title: subject,
        body,
        buttonText: "View Your Listings",
        buttonUrl: `${base}/listings`,
    });

    await transport.sendMail({ from: fromAddress, to: hostEmail, subject, html });
    console.log(`[email] Sent: ${subject} → ${hostEmail}`);
}

// ─── 6. New Review Notification → Host ──────────────────────────────────────

/**
 * Sent to listing owner when someone posts a review.
 *
 * @param {string} hostEmail
 * @param {object} review   - the new review document
 * @param {object} listing  - the listing that was reviewed
 * @param {string} authorUsername - reviewer's username
 */
async function sendNewReviewNotificationToHost(hostEmail, review, listing, authorUsername) {
    const base = getBaseUrl();
    const subject = `New review on your listing — ${listing.title}`;

    const stars = "\u2605".repeat(review.rating) + "\u2606".repeat(5 - review.rating);

    const body = `
    <p><strong>${authorUsername}</strong> left a ${review.rating}-star review on your listing.</p>
    <p style="font-size:22px;letter-spacing:2px;color:#C0602A;margin:8px 0">
      ${stars}
    </p>
    <blockquote style="border-left:3px solid #C0602A;margin:16px 0;
                       padding:12px 20px;background:#FAF7F2;
                       border-radius:0 8px 8px 0">
      <em style="color:#555">"${review.comment}"</em>
    </blockquote>
    <table style="width:100%;border-collapse:collapse;margin:20px 0">
      ${buildDetailRow("Listing", listing.title)}
      ${buildDetailRow("Location", listing.location)}
    </table>`;

    const html = buildEmailHtml({
        title: subject,
        body,
        buttonText: "View Your Listing",
        buttonUrl: `${base}/listings/${listing._id}`,
    });

    await transport.sendMail({ from: fromAddress, to: hostEmail, subject, html });
    console.log(`[email] Sent: ${subject} → ${hostEmail}`);
}

// ─── 7. New Message Notification ────────────────────────────────────────────

/**
 * Notifies a user that they received a new message.
 *
 * @param {string} toEmail        - Recipient email
 * @param {string} senderUsername - Who sent the message
 * @param {string} messageBody    - The message content (truncated)
 * @param {string} listingTitle   - Which listing this is about
 * @param {string} conversationId - Link to the conversation
 */
async function sendNewMessageNotification(
    toEmail, senderUsername, messageBody, listingTitle, conversationId
) {
    const subject = `New message from ${senderUsername} — ${listingTitle}`;

    const preview = messageBody.length > 200
        ? messageBody.substring(0, 200) + "..."
        : messageBody;

    const html = buildEmailHtml({
        title: `New message from ${senderUsername}`,
        body: `
      <p>You have a new message about
         <strong>${listingTitle}</strong>.</p>

      <div style="background:#FAF7F2;border-left:3px solid #C0602A;
                  border-radius:0 8px 8px 0;padding:16px 20px;
                  margin:20px 0">
        <p style="margin:0;color:#555;font-style:italic;
                  font-size:15px;line-height:1.6">
          "${preview}"
        </p>
        <p style="margin:8px 0 0;font-size:12px;color:#B8A99A">
          — ${senderUsername}
        </p>
      </div>

      <p style="color:#888;font-size:14px">
        Reply to this message on WanderLust to keep
        the conversation going.
      </p>
    `,
        buttonText: "View Message",
        buttonUrl: `${getBaseUrl()}/conversations/${conversationId}`,
        footerNote: "You received this because someone messaged you on WanderLust.",
    });

    await transport.sendMail({
        from: fromAddress,
        to: toEmail,
        subject,
        html,
    });

    console.log(`[email] ✓ Sent "${subject}" → ${toEmail}`);
}

// ─── Exports ─────────────────────────────────────────────────────────────────

module.exports = {
    sendPasswordResetEmail,
    sendBookingRequestToGuest,
    sendBookingNotificationToHost,
    sendBookingConfirmedToGuest,
    sendBookingCancelledToGuest,
    sendCancellationNotificationToHost,
    sendNewReviewNotificationToHost,
    sendNewMessageNotification,
};
