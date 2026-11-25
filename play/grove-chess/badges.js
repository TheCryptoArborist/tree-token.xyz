export const BADGES = [
  {
    "id": "first-roots",
    "name": "First Roots",
    "description": "Complete an online game with at least four half-moves.",
    "stat": "games",
    "target": 1
  },
  {
    "id": "sapling-victor",
    "name": "Sapling Victor",
    "description": "Win your first online game.",
    "stat": "wins",
    "target": 1
  },
  {
    "id": "grove-guardian",
    "name": "Grove Guardian",
    "description": "Win five online games.",
    "stat": "wins",
    "target": 5
  },
  {
    "id": "ancient-oak",
    "name": "Ancient Oak",
    "description": "Win twenty online games.",
    "stat": "wins",
    "target": 20
  },
  {
    "id": "twin-canopies",
    "name": "Twin Canopies",
    "description": "Win at least once as Birch and once as Pine.",
    "stat": "bothColors",
    "target": 1
  },
  {
    "id": "crown-keeper",
    "name": "Crown Keeper",
    "description": "Win an online game by checkmate.",
    "stat": "mates",
    "target": 1
  },
  {
    "id": "root-fortress",
    "name": "Root Fortress",
    "description": "Castle and win in the same online game.",
    "stat": "castleWins",
    "target": 1
  },
  {
    "id": "new-growth",
    "name": "New Growth",
    "description": "Promote a pawn in a completed online game.",
    "stat": "promotions",
    "target": 1
  },
  {
    "id": "rare-bloom",
    "name": "Rare Bloom",
    "description": "Promote to a rook, bishop or knight in a completed online game.",
    "stat": "underpromotions",
    "target": 1
  },
  {
    "id": "hidden-root",
    "name": "Hidden Root",
    "description": "Capture en passant in a completed online game.",
    "stat": "enPassants",
    "target": 1
  }
];
export function badgeProgress(badge,stats={}){const value=badge.stat==='bothColors'?Math.min(stats.whiteWins||0,stats.blackWins||0):(stats[badge.stat]||0);return {value:Math.min(value,badge.target),earned:value>=badge.target};}
