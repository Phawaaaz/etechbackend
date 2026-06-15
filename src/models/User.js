import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: [true, "Name is required"],
      trim: true,
      minlength: [2, "Name must be at least 2 characters"],
      maxlength: [80, "Name must be at most 80 characters"],
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^\S+@\S+\.\S+$/, "Please provide a valid email address"],
    },
    password: {
      type: String,
      required: [true, "Password is required"],
      minlength: [8, "Password must be at least 8 characters"],
      maxlength: [128, "Password must be at most 128 characters"],
      select: false,
    },
    // Stored as SHA-256 hash — never the raw token
    refreshTokenHash: {
      type: String,
      select: false,
    },
    // Used to invalidate access tokens issued before a password change
    passwordChangedAt: {
      type: Date,
      select: false,
    },
  },
  { timestamps: true }
);

// Hash password before saving. bcrypt silently truncates at 72 bytes,
// so we enforce max 128 chars at the schema and Zod level.
userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  // Record the time so protect() can reject tokens issued before this moment
  if (!this.isNew) this.passwordChangedAt = new Date();
  next();
});

// Compare plain password with stored hash
userSchema.methods.comparePassword = async function (plain) {
  return bcrypt.compare(plain, this.password);
};

// Returns true if the token was issued before the last password change
userSchema.methods.passwordChangedAfter = function (jwtIssuedAt) {
  if (this.passwordChangedAt) {
    return jwtIssuedAt * 1000 < this.passwordChangedAt.getTime();
  }
  return false;
};

export const User = mongoose.model("User", userSchema);
