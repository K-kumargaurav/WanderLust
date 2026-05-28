const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const conversationSchema = new Schema({

  // The two people in this conversation
  participants: [
    {
      type:     Schema.Types.ObjectId,
      ref:      'User',
      required: true,
    },
  ],

  // Which listing this conversation is about
  listing: {
    type:     Schema.Types.ObjectId,
    ref:      'Listing',
    required: true,
  },

  // Optional: linked booking (null if pre-booking inquiry)
  booking: {
    type:    Schema.Types.ObjectId,
    ref:     'Booking',
    default: null,
  },

  // Preview text for inbox list
  lastMessage: {
    type:    String,
    default: '',
    maxlength: 200,
  },

  lastMessageAt: {
    type:    Date,
    default: Date.now,
  },

  // Track unread count per participant
  unreadCount: {
    type:    Map,
    of:      Number,
    default: {},
  },

  createdAt: {
    type:    Date,
    default: Date.now,
  },
});

// Indexes for fast queries
conversationSchema.index({ participants: 1 });
conversationSchema.index({ listing: 1 });
conversationSchema.index({ lastMessageAt: -1 });
conversationSchema.index({ booking: 1 });

// Static method: find existing conversation between two users
// about a specific listing (prevent duplicate conversations)
conversationSchema.statics.findExisting = function(
  userId1, userId2, listingId
) {
  return this.findOne({
    participants: { $all: [userId1, userId2] },
    listing:      listingId,
  });
};

module.exports = mongoose.model('Conversation', conversationSchema);
