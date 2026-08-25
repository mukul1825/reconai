const mongoose = require("mongoose");

const batchSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    matchRate: {
      type: Number,
      default: null, // computed after matching pipeline runs
    },
    status: {
      type: String,
      enum: ["processing", "complete", "failed"],
      default: "processing",
    },
  },
  { timestamps: { createdAt: "uploadedAt", updatedAt: false } }
);

module.exports = mongoose.model("Batch", batchSchema);
