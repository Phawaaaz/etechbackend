import mongoose from "mongoose";

const sectionIndexSchema = new mongoose.Schema(
  {
    order: { type: Number, required: true },
    title: { type: String, required: true },
    summary: { type: String, required: true },
    estimatedMinutes: { type: Number, default: 15 },
  },
  { _id: false }
);

const courseSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    subject: { type: String, required: true, trim: true },
    topic: { type: String, required: true, trim: true },
    level: {
      type: String,
      enum: ["Beginner", "Intermediate", "Advanced"],
      required: true,
    },
    description: { type: String },
    estimatedHours: { type: Number },
    index: [sectionIndexSchema],
  },
  { timestamps: true }
);

export const Course = mongoose.model("Course", courseSchema);
