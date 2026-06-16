import mongoose from "mongoose";

// A content block inside a section — text, image, code, or video
const blockSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: ["text", "image", "code", "video"],
      required: true,
    },
    // text: markdown prose
    // image: Pollinations URL
    // code: raw code string
    // video: YouTube search URL or embed link
    content: { type: String, required: true },
    caption: { type: String },
    language: { type: String },  // for code blocks
    order: { type: Number, required: true },
  },
  { _id: false }
);

const quizQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true },
    options: { type: [String], required: true },
    answer: { type: String, required: true },
    explanation: { type: String, required: true },
  },
  { _id: false }
);

const conceptSchema = new mongoose.Schema(
  {
    title: { type: String, required: true },
    blocks: [blockSchema],
  },
  { _id: false }
);

const sectionSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    order: { type: Number, required: true },
    title: { type: String, required: true },

    // Section structure
    overview: { type: String },           // 2-3 paragraph intro
    concepts: [conceptSchema],            // deep concept blocks
    workedExample: {
      problem: { type: String },
      steps: [{ type: String }],
      code: { type: String },
      language: { type: String },
      expectedOutput: { type: String },
    },
    commonMistakes: [{ type: String }],   // list of mistakes + corrections
    keyTakeaways: [{ type: String }],
    furtherReading: [{ type: String }],
    quiz: [quizQuestionSchema],
  },
  { timestamps: true }
);

export const Section = mongoose.model("Section", sectionSchema);
