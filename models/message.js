const mongoose = require('mongoose');
const Schema   = mongoose.Schema;

const messageSchema = new Schema({

  // Which conversation this message belongs to
  conversation: {
    type:     Schema.Types.ObjectId,
    ref:      'Conversation',
    required: true,
  },

  // Who sent it
  sender: {
    type:     Schema.Types.ObjectId,
    ref:      'User',
    required: true,
  },

  // Message content
  body: {
    type:      String,
    required:  true,
    trim:      true,
    maxlength: 2000,
  },

  // Has the OTHER participant read this message?
  read: {
    type:    Boolean,
    default: false,
  },

  createdAt: {
    type:    Date,
    default: Date.now,
  },
});

// Indexes for fast queries
messageSchema.index({ conversation: 1, createdAt: 1 });
messageSchema.index({ sender: 1 });
messageSchema.index({ conversation: 1, read: 1 });

module.exports = mongoose.model('Message', messageSchema);
