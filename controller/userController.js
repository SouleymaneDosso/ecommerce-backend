const User = require("../models/User");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res, next) => {
  const { username, email, password } = req.body;
  if (!username || !email || !password)
    return res.status(400).json({ message: "Tous les champs sont requis" });

  try {
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser)
      return res.status(400).json({ message: "Nom d'utilisateur ou email déjà utilisé" });

    const user = new User({ username, email, password });
    await user.save();

    res.status(201).json({ message: "Utilisateur créé avec succès" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};

exports.login = async (req, res, next) => {
  const { username, password } = req.body;
  if (!username || !password)
    return res.status(400).json({ message: "Tous les champs sont requis" });

  try {
    const user = await User.findOne({ username });
    if (!user) return res.status(400).json({ message: "Utilisateur non trouvé" });

    const isMatch = await user.comparePassword(password);
    if (!isMatch) return res.status(400).json({ message: "Mot de passe incorrect" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET_CLIENT, { expiresIn: "7d" });

    res.status(200).json({ token, userId: user._id, username: user.username });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
};
