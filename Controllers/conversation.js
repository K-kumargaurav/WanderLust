const Conversation = require('../models/conversation.js');
const Message      = require('../models/message.js');
const Listing      = require('../models/listing.js');
const Booking      = require('../models/booking.js');
const AppError     = require('../utils/expressErr.js');
const { sendNewMessageNotification } =
  require('../services/email.service.js');

/**
 * Shows all conversations for the logged-in user.
 * Sorted by most recent message first.
 *
 * @route  GET /conversations
 * @access Authenticated
 */
async function renderInbox(req, res) {

  const conversations = await Conversation
    .find({ participants: req.user._id })
    .populate('listing', 'title images location')
    .populate('participants', 'username email')
    .populate('booking', 'checkIn checkOut status')
    .sort({ lastMessageAt: -1 });

  // Calculate total unread count across all conversations
  const totalUnread = conversations.reduce((sum, conv) => {
    return sum + (conv.unreadCount.get(req.user._id.toString()) || 0);
  }, 0);

  res.render('conversations/inbox.ejs', {
    conversations,
    totalUnread,
  });
}

/**
 * Opens a single conversation and shows all messages.
 * Marks all unread messages as read.
 *
 * @route  GET /conversations/:id
 * @access Authenticated — must be a participant
 */
async function renderConversation(req, res) {

  const conversation = await Conversation
    .findById(req.params.id)
    .populate('listing', 'title images location country price owner')
    .populate('participants', 'username email')
    .populate('booking', 'checkIn checkOut status totalPrice nights');

  if (!conversation) {
    req.flash('error', 'Conversation not found.');
    return req.session.save(() => res.redirect('/conversations'));
  }

  // Must be a participant
  const isParticipant = conversation.participants.some(
    (p) => p._id.equals(req.user._id)
  );
  if (!isParticipant) {
    req.flash('error', 'You do not have access to this conversation.');
    return req.session.save(() => res.redirect('/conversations'));
  }

  // Fetch all messages in chronological order
  const messages = await Message
    .find({ conversation: conversation._id })
    .populate('sender', 'username')
    .sort({ createdAt: 1 });

  // Mark unread messages as read
  await Message.updateMany(
    {
      conversation: conversation._id,
      sender:       { $ne: req.user._id },
      read:         false,
    },
    { read: true }
  );

  // Reset unread count for this user
  conversation.unreadCount.set(req.user._id.toString(), 0);
  await conversation.save();

  // Find the other participant
  const otherParticipant = conversation.participants.find(
    (p) => !p._id.equals(req.user._id)
  );

  res.render('conversations/show.ejs', {
    conversation,
    messages,
    otherParticipant,
  });
}

/**
 * Starts a new conversation OR reopens existing one.
 * Called when guest clicks "Message Host" on listing show page
 * OR when host clicks "Message Guest" on host bookings page.
 *
 * @route  POST /conversations
 * @access Authenticated
 */
async function startConversation(req, res) {

  const { listingId, recipientId, bookingId, initialMessage } = req.body;

  if (!listingId || !recipientId) {
    req.flash('error', 'Missing required fields.');
    return req.session.save(() => res.redirect('back'));
  }

  if (!initialMessage || initialMessage.trim().length === 0) {
    req.flash('error', 'Please write a message before sending.');
    return req.session.save(() => res.redirect('back'));
  }

  if (initialMessage.trim().length > 2000) {
    req.flash('error', 'Message too long (max 2000 characters).');
    return req.session.save(() => res.redirect('back'));
  }

  // Prevent messaging yourself
  if (req.user._id.equals(recipientId)) {
    req.flash('error', 'You cannot message yourself.');
    return req.session.save(() => res.redirect('back'));
  }

  const listing = await Listing.findById(listingId);
  if (!listing) {
    req.flash('error', 'Listing not found.');
    return req.session.save(() => res.redirect('/listings'));
  }

  // Find existing conversation or create new one
  let conversation = await Conversation.findExisting(
    req.user._id, recipientId, listingId
  );

  if (!conversation) {
    conversation = await Conversation.create({
      participants:  [req.user._id, recipientId],
      listing:       listingId,
      booking:       bookingId || null,
      lastMessage:   initialMessage.trim().substring(0, 200),
      lastMessageAt: new Date(),
      unreadCount:   { [recipientId.toString()]: 1 },
    });
  }

  // Save the first/new message
  const message = await Message.create({
    conversation: conversation._id,
    sender:       req.user._id,
    body:         initialMessage.trim(),
    read:         false,
  });

  // Update conversation preview
  conversation.lastMessage   = message.body.substring(0, 200);
  conversation.lastMessageAt = new Date();
  conversation.unreadCount.set(
    recipientId.toString(),
    (conversation.unreadCount.get(recipientId.toString()) || 0) + 1
  );
  await conversation.save();

  // Send email notification to recipient (best effort)
  try {
    const populatedConv = await Conversation
      .findById(conversation._id)
      .populate('participants', 'username email')
      .populate('listing', 'title');

    const recipient = populatedConv.participants.find(
      (p) => p._id.toString() === recipientId.toString()
    );

    if (recipient?.email) {
      await sendNewMessageNotification(
        recipient.email,
        req.user.username,
        message.body,
        listing.title,
        conversation._id.toString()
      );
    }
  } catch (emailErr) {
    console.error('[email] message notification failed:', emailErr.message);
  }

  req.flash('success', 'Message sent!');
  return req.session.save(() =>
    res.redirect('/conversations/' + conversation._id)
  );
}

/**
 * Sends a new message in an existing conversation.
 *
 * @route  POST /conversations/:id/messages
 * @access Authenticated — must be a participant
 */
async function sendMessage(req, res) {

  const conversation = await Conversation
    .findById(req.params.id)
    .populate('participants', 'username email')
    .populate('listing', 'title');

  if (!conversation) {
    req.flash('error', 'Conversation not found.');
    return req.session.save(() => res.redirect('/conversations'));
  }

  // Must be a participant
  const isParticipant = conversation.participants.some(
    (p) => p._id.equals(req.user._id)
  );
  if (!isParticipant) {
    req.flash('error', 'You do not have access to this conversation.');
    return req.session.save(() => res.redirect('/conversations'));
  }

  const { body } = req.body;

  if (!body || body.trim().length === 0) {
    req.flash('error', 'Message cannot be empty.');
    return req.session.save(() =>
      res.redirect('/conversations/' + req.params.id)
    );
  }

  if (body.trim().length > 2000) {
    req.flash('error', 'Message too long (max 2000 characters).');
    return req.session.save(() =>
      res.redirect('/conversations/' + req.params.id)
    );
  }

  // Find the other participant
  const recipient = conversation.participants.find(
    (p) => !p._id.equals(req.user._id)
  );

  // Save message
  const message = await Message.create({
    conversation: conversation._id,
    sender:       req.user._id,
    body:         body.trim(),
    read:         false,
  });

  // Update conversation preview and unread count
  conversation.lastMessage   = message.body.substring(0, 200);
  conversation.lastMessageAt = new Date();
  if (recipient) {
    conversation.unreadCount.set(
      recipient._id.toString(),
      (conversation.unreadCount.get(recipient._id.toString()) || 0) + 1
    );
  }
  await conversation.save();

  // Email notification to recipient (best effort)
  try {
    if (recipient?.email) {
      await sendNewMessageNotification(
        recipient.email,
        req.user.username,
        message.body,
        conversation.listing.title,
        conversation._id.toString()
      );
    }
  } catch (emailErr) {
    console.error('[email] message notification failed:', emailErr.message);
  }

  return req.session.save(() =>
    res.redirect('/conversations/' + conversation._id)
  );
}

/**
 * Returns unread message count for the logged-in user.
 * Called by the navbar polling script every 30 seconds.
 *
 * @route  GET /conversations/unread-count
 * @access Authenticated
 */
async function getUnreadCount(req, res) {
  const conversations = await Conversation.find({
    participants: req.user._id,
  });

  const total = conversations.reduce((sum, conv) => {
    return sum + (conv.unreadCount.get(req.user._id.toString()) || 0);
  }, 0);

  res.json({ unread: total });
}

module.exports = {
  renderInbox,
  renderConversation,
  startConversation,
  sendMessage,
  getUnreadCount,
};
