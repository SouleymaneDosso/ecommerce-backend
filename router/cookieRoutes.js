router.post("/consent", (req, res) => {
  const { marketingConsent } = req.body;

  if (marketingConsent === undefined) {
    return res.status(400).json({ message: "Consentement requis" });
  }

  res.cookie("marketingConsent", marketingConsent, {
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 365 * 24 * 60 * 60 * 1000,
  });

  res.status(200).json({ message: "Consentement enregistré ✅" });
});

router.get("/consent", (req, res) => {
  
  const marketingConsent = req.cookies.marketingConsent === "true";
  res.status(200).json({ marketingConsent });
});