import mongoose from "mongoose";

const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
    },
    sectionId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Section",
      required: true,
    },
    status: {
      type: String,
      enum: ["not_started", "in_progress", "completed"],
      default: "not_started",
    },
    quizAttempts: [
      {
        answers: [{ type: String }],
        score: { type: Number },          // 0-100
        passed: { type: Boolean },
        attemptedAt: { type: Date, default: Date.now },
      },
    ],
    bestQuizScore: { type: Number, default: 0 },
    completedAt: { type: Date },
  },
  { timestamps: true }
);

// One progress record per user+section
progressSchema.index({ userId: 1, sectionId: 1 }, { unique: true });

export const Progress = mongoose.model("Progress", progressSchema);
