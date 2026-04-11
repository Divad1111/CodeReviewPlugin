const mongoose = require('mongoose');
const { Schema } = mongoose;

const UserSchema = new Schema({
  username: String,
  roles: [String],
  role: String
});
const User = mongoose.model('User', UserSchema);

async function check() {
  await mongoose.connect('mongodb://localhost:27017/code_review');
  const users = await User.find({}).lean();
  console.log(JSON.stringify(users, null, 2));
  process.exit();
}
check();
