import { useState, useEffect } from 'react';

const WORD_CODES = [
  'ABLE','ARCH','ARMY','BACK','BALL','BAND','BARK','BARN','BATH','BEAM',
  'BEAR','BIRD','BLUE','BOAT','BOLD','BOOK','BURN','CALM','CAMP','CARD',
  'CAVE','CLAY','CLUB','COAT','CODE','COIN','COOL','CORE','CORN','CREW',
  'CURE','DARK','DAWN','DEAL','DEEP','DIVE','DOOR','DRAG','DRAW','DROP',
  'DRUM','DUSK','DUST','EDGE','EPIC','FACE','FACT','FALL','FARM','FAST',
  'FATE','FIRE','FISH','FLAG','FLAT','FLOW','FOAM','FOLD','FOLK','FOOD',
  'FORD','FORM','FREE','FUEL','FULL','FUND','GAME','GATE','GEAR','GIFT',
  'GLOW','GOAL','GOLD','GOOD','GRAB','GROW','HALF','HAND','HARD','HARM',
  'HEAD','HEAL','HEAT','HELP','HIDE','HIGH','HILL','HOLE','HOLY','HOME',
  'HOPE','HORN','HOST','HUNT','ICON','JADE','JUMP','JUST','KEEN','KEEP',
  'KICK','KIND','KING','KNOW','LACE','LAKE','LAND','LANE','LAVA','LAWN',
  'LEAD','LEAF','LEAN','LEAP','LENS','LIFT','LIKE','LIME','LINE','LINK',
  'LION','LIVE','LOAD','LOCK','LOFT','LONE','LONG','LOOK','LOOP','LORD',
  'LOVE','LUCK','LUSH','MAIN','MAKE','MANY','MARK','MASK','MAZE','MEAL',
  'MEAT','MELT','MILD','MILE','MIND','MINT','MIST','MODE','MOON','MOVE',
  'MUSE','MUST','NAME','NAVY','NEAT','NECK','NEED','NEST','NEWS','NICE',
  'NODE','NORM','NOTE','NOVA','OATH','ONCE','OPEN','PACE','PAGE','PAIN',
  'PALE','PALM','PART','PASS','PAST','PATH','PEAK','PINE','PINK','PLAN',
  'POEM','POLE','POOL','PORT','POSE','POST','POUR','PREY','PULL','PUMP',
  'PURE','PUSH','RACE','RACK','RAGE','RAIN','RANK','RARE','RATE','READ',
  'REAL','REED','REEF','RELY','RENT','REST','RICE','RICH','RIDE','RING',
  'RISE','RISK','ROAD','ROCK','ROLE','ROLL','ROOF','ROPE','ROSE','RULE',
  'RUSH','RUST','SAFE','SAGE','SAIL','SALT','SAME','SAND','SEAL','SEED',
  'SEEK','SELF','SHED','SHIP','SHOE','SHOT','SHOW','SIGN','SILK','SITE',
  'SIZE','SKIN','SLIM','SLIP','SLOW','SNOW','SOAR','SOFT','SOIL','SOME',
  'SONG','SOON','SORT','SOUL','SOUP','SPAN','SPIN','SPOT','SPUR','STAR',
  'STEM','STEP','STOP','SUIT','SURF','SWAP','TALE','TALK','TALL','TAME',
  'TANK','TAPE','TASK','TEAM','TELL','TENT','TERM','TIDE','TILE','TIME',
  'TONE','TOOL','TREE','TRIP','TRUE','TURF','TURN','TYPE','UNIT','VALE',
  'VAST','VEIN','VIEW','VINE','VOTE','WADE','WAKE','WALK','WALL','WARD',
  'WARM','WAVE','WIDE','WILD','WILL','WIND','WINE','WING','WISE','WOLF',
  'WOOD','WORD','WORK','WRAP','YEAR','ZINC','ZONE',
];

interface Props {
  onCreated: (roomCode: string) => void;
  onJoined: (roomCode: string) => void;
  onBack: () => void;
}

export default function OnlineSetup({ onCreated, onJoined, onBack }: Props) {
  const [joinCode, setJoinCode] = useState('');

  // Auto-fill from ?join= URL param
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get('join');
    if (code) setJoinCode(code.toUpperCase());
  }, []);

  const handleCreate = () => {
    const code = WORD_CODES[Math.floor(Math.random() * WORD_CODES.length)];
    onCreated(code);
  };

  const handleJoin = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length < 4) return;
    onJoined(code);
  };

  return (
    <div className="min-h-screen bg-[#111] text-stone-200 flex items-center justify-center">
      <div className="flex flex-col items-center gap-6 p-8 border border-stone-800 rounded-xl bg-[#0e0e0e] max-w-sm w-full mx-4">
        <div className="flex items-center gap-2">
          <div className="w-3.5 h-3.5 rounded-full bg-[#111] border-2 border-stone-600" />
          <div className="w-3.5 h-3.5 rounded-full bg-stone-100 border border-stone-400" />
          <span className="text-stone-300 font-medium tracking-wide text-sm ml-1">Gomoku</span>
        </div>

        <div className="w-full flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <p className="text-stone-400 text-xs uppercase tracking-wider">Start a new game</p>
            <button
              onClick={handleCreate}
              className="w-full py-3 rounded border border-amber-700/50 bg-amber-900/20 text-amber-400 hover:bg-amber-900/30 transition-colors font-medium"
            >
              Create a game
            </button>
          </div>

          <div className="flex items-center gap-3">
            <hr className="flex-1 border-stone-800" />
            <span className="text-stone-600 text-xs">or</span>
            <hr className="flex-1 border-stone-800" />
          </div>

          <div className="flex flex-col gap-2">
            <p className="text-stone-400 text-xs uppercase tracking-wider">Join a friend's game</p>
            <input
              type="text"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
              onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
              placeholder="Enter room code"
              maxLength={12}
              className="w-full bg-[#111] border border-stone-700 rounded px-3 py-2 text-stone-200 placeholder:text-stone-600 focus:outline-none focus:border-amber-700 text-center font-mono tracking-widest"
            />
            <button
              onClick={handleJoin}
              disabled={joinCode.trim().length < 4}
              className="w-full py-2.5 rounded border border-stone-700 text-stone-300 hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Connect
            </button>
          </div>
        </div>

        <button
          onClick={onBack}
          className="text-xs text-stone-600 hover:text-stone-400 transition-colors"
        >
          ← Back
        </button>
      </div>
    </div>
  );
}
