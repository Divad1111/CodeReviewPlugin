const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  username: { type: String, required: true },
  passwordHash: { type: String, required: true },
  roles: [{ type: String, enum: ['reviewer', 'reviewee'], default: ['reviewee'] }],
  parentReviewer: { type: String, default: null },
});

const User = mongoose.model('User', UserSchema);

async function test() {
  await mongoose.connect('mongodb://localhost:27017/code_review');
  const users = await User.find({}).lean();
  console.log(JSON.stringify(users, null, 2));
  process.exit();
}
test();
