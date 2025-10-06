const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  username: { type: String, unique: true, required: true },
  password: { type: String, required: true },
  profile: {
    name: { type: String },
    location: { type: String },
    bio: { type: String }
  }
});

module.exports = mongoose.model("User", userSchema);
