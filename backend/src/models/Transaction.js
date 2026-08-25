const mongoose = require("mongoose");

const transactionSchema = new mongoose.Schema({
  source: {
    type: String,
    enum: ["bank", "settlement", "ledger"],
    required: true,
  },
  orderId: { type: String, default: null },
  amount: { type: Number, required: true },
  date: { type: Date, required: true },
  utr: { type: String, default: null },
  paymentId: { type: String, default: null }, // Razorpay payment id (settlement source only)
  fee: { type: Number, default: 0 },
  tax: { type: Number, default: 0 },
  batchId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Batch",
    required: true,
  },
  matchStatus: {
    type: String,
    enum: ["unmatched", "auto_resolved", "pending_review", "resolved", "rejected"],
    default: "unmatched",
  },
  createdAt: { type: Date, default: Date.now },
});

transactionSchema.index({ batchId: 1, matchStatus: 1 });
transactionSchema.index({ orderId: 1 });
transactionSchema.index({ utr: 1 });

module.exports = mongoose.model("Transaction", transactionSchema);
