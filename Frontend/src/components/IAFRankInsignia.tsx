interface IAFRankInsigniaProps {
  rank: string;
  short?: boolean;
}

interface RankConfig {
  bars: number;
  stars: number;
}

const rankConfig: Record<string, RankConfig> = {
  "flying officer": { bars: 1, stars: 0 },
  "flight lieutenant": { bars: 2, stars: 0 },
  "squadron leader": { bars: 3, stars: 0 },
  "wing commander": { bars: 4, stars: 0 },
  "group captain": { bars: 5, stars: 0 },
  "air commodore": { bars: 1, stars: 1 },
  "air vice marshal": { bars: 3, stars: 2 },
  "air marshal": { bars: 4, stars: 3 },
  "air chief marshal": { bars: 5, stars: 4 },
  "marshal of the air force": { bars: 6, stars: 5 },
  "captain": { bars: 2, stars: 0 },
  "lieutenant": { bars: 1, stars: 0 },
  "major": { bars: 3, stars: 0 },
};

const getRankConfig = (rank: string): RankConfig => {
  const key = rank.toLowerCase();
  return rankConfig[key] || { bars: 2, stars: 0 };
};

const IAFRankInsignia = ({ rank, short = true }: IAFRankInsigniaProps) => {
  const config = getRankConfig(rank);

  return (
    <div className="inline-flex items-center gap-2">
      <div className="rounded border border-cyan-300/30 bg-slate-800/80 p-1">
        <div className="h-8 w-6 bg-slate-700 px-[2px] py-[3px]">
          <div className="flex h-full flex-col justify-end gap-[2px]">
            {Array.from({ length: config.bars }).map((_, idx) => (
              <span key={idx} className="h-[2px] w-full bg-sky-300/90" />
            ))}
          </div>
        </div>
      </div>
      {config.stars > 0 && (
        <div className="flex gap-[2px] text-[10px] text-slate-200">
          {Array.from({ length: config.stars }).map((_, idx) => (
            <span key={idx}>*</span>
          ))}
        </div>
      )}
      {!short && <span className="font-rajdhani text-sm text-muted-foreground">{rank}</span>}
    </div>
  );
};

export default IAFRankInsignia;
