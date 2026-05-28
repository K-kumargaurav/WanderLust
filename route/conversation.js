const express            = require('express');
const router             = express.Router();
const wrapAsync          = require('../utils/wrapAsync.js');
const { isLoggedIn, validateCsrf, validateMessage, validateConversation } = require('../middleware.js');
const conversationController =
  require('../Controllers/conversation.js');

// Inbox — list all conversations
router.get(
  '/conversations',
  isLoggedIn,
  wrapAsync(conversationController.renderInbox)
);

// Unread count — polled by navbar every 30s
router.get(
  '/conversations/unread-count',
  isLoggedIn,
  wrapAsync(conversationController.getUnreadCount)
);

// Open a conversation
router.get(
  '/conversations/:id',
  isLoggedIn,
  wrapAsync(conversationController.renderConversation)
);

// Start a new conversation
router.post(
  '/conversations',
  isLoggedIn,
  validateCsrf,
  validateConversation,
  wrapAsync(conversationController.startConversation)
);

// Send a message in existing conversation
router.post(
  '/conversations/:id/messages',
  isLoggedIn,
  validateCsrf,
  validateMessage,
  wrapAsync(conversationController.sendMessage)
);

module.exports = router;
