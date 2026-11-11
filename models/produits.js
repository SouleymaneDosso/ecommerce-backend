const mongoose = require("mongoose");

const imageSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    isMain: {
      type: Boolean,
      default: false,
    },
  },
  { _id: false },
);

const schemaproduits = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
      trim: true,
    },

    description: {
      type: String,
      required: true,
    },

    images: {
      type: [imageSchema],
      required: true,
      validate: {
        validator: (arr) => Array.isArray(arr) && arr.length > 0,
        message: "Au moins une image est requise",
      },
    },

    userId: {
      type: String,
      required: true,
    },

    // Prix de vente actuel
    price: {
      type: Number,
      required: true,
      min: 0,
      index: true,
    },

    // Ancien prix avant réduction
    // Null = aucun prix comparatif
    prixAvant: {
      type: Number,
      default: null,
      min: 0,
    },

    stock: {
      type: Number,
      default: 0,
    },

    tailles: {
      type: [String],
      default: [],
    },

    couleurs: {
      type: [String],
      default: [],
    },

    averageRating: {
      type: Number,
      default: 0,
    },

    stockParVariation: {
      type: Map,
      of: {
        type: Map,
        of: Number,
      },
      default: {},
    },

    commentaires: {
      type: [
        {
          user: String,
          message: String,
          rating: Number,
          createdAt: {
            type: Date,
            default: Date.now,
          },
        },
      ],
      default: [],
    },

    hero: {
      type: Boolean,
      default: false,
    },

    bestSeller: {
      type: Boolean,
      default: false,
      index: true,
    },

    genre: {
      type: String,
      enum: ["homme", "femme", "enfant"],
      required: true,
    },

    categorie: {
      type: String,
      enum: ["haut", "bas", "robe", "chaussure", "tout"],
      required: true,
      index: true,
    },

    badge: {
      type: String,
      enum: ["new", "promo", null],
      default: null,
    },

    details: {
      type: Map,
      of: String,
    },

    videoId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Video",
      default: null,
    },

    precommande: {
      type: Boolean,
      default: false,
      index: true,
    },

    montantDepot: {
      type: Number,
      default: null,
      min: 0,
    },

    disponible: {
      type: Boolean,
      default: true,
      index: true,
    },

    dateDisponibilite: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
    },
    toObject: {
      virtuals: true,
    },
  },
);


// ==============================
// VALIDATION PRIX COMPARATIF
// ==============================

schemaproduits.pre("validate", async function () {
  if (this.prixAvant !== null && this.prixAvant !== undefined) {
    if (this.prixAvant <= this.price) {
      this.invalidate(
        "prixAvant",
        "L'ancien prix doit être supérieur au prix actuel.",
      );
    }
  }

  if (this.badge === "promo" && this.prixAvant == null) {
    this.invalidate(
      "prixAvant",
      "Une promotion doit avoir un ancien prix.",
    );
  }
});


// ==============================
// VIRTUAL : POURCENTAGE DE RÉDUCTION
// ==============================

schemaproduits.virtual("pourcentageReduction").get(function () {
  if (
    this.prixAvant == null ||
    !this.price ||
    this.prixAvant <= this.price
  ) {
    return 0;
  }

  return Math.round(
    ((this.prixAvant - this.price) / this.prixAvant) * 100,
  );
});

module.exports = mongoose.model("Produits", schemaproduits);
