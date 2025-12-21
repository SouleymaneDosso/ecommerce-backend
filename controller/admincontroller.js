const Admin = require("../models/admin");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

exports.signup = async (req, res, next) => {
  try {
    const worl = await bcrypt.hash(req.body.password, 10);
    const admin = new Admin({
      username: req.body.username,
      password: worl,
    });

    const save = await admin.save();
    if (!save) {
      return console.log("identifiant incorrect !");
    }
    res.status(201).json({ message: "utilisateur créé !" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.login = async (req, res, next) => {
  try {
    const admin = await Admin.findOne({ username: req.body.username });
    if (!admin) {
      return res.status(401).json({ message: "mot de passe incorrecte" });
    }
    const comparaison = await bcrypt.compare(req.body.password, admin.password);
    if (!comparaison) {
      return res.status(401).json({ message: "mot de passe incorrecte" });
    }
    res.status(200).json({
        userId: admin._id,
        token: jwt.sign({userId: admin._id },
            process.env.JWT_SECRET, 
            {expiresIn: '1h' }
        )
    })
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};
