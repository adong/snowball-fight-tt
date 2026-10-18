/* 中文 for SnowbaTTle: the words on the page, the toasts and banners, the ? panel, and the words drawn in 3D
   (comic bursts, name tags, the BIG on the giant-snowball power-up, through Kit.lang.t in js/fx.js and js/game.js).
   The kids' names and the game's name and logo stay in English on purpose, and so do the friends' names. */
(function () {
  const L = Kit.lang;
  L.keep([
    'SnowbaTTle', 'TEDDY', 'TOMMY', 'Teddy', 'Tommy', 'TEDDY & TOMMY', 'SNOWBA', 'TT', 'LE', // the logo
    'ZOOM', 'LUNA', 'BOLT', 'BRUNO', 'VOLT', 'VS', 'Esc',
  ]);

  L.add({
    // title screen
    'Teddy vs Tommy in a snowy backyard. 打雪仗! Scoop snow, throw, duck behind your fort, and call your brother for help.':
      'Teddy 对 Tommy，在下雪的后院打雪仗！捏雪球、扔雪球、躲到雪堡后面，还能叫兄弟来帮忙。',
    'you vs the computer': '你 对 电脑', 'brother vs brother, one keyboard': '兄弟对决，一个键盘',
    'CO-OP': '合作', 'brothers vs the Snow Crew': '兄弟一起打雪人队',
    'CPU': '电脑', 'Computer level': '电脑难度', '🐣 EASY': '🐣 简单', '🔥 NORMAL': '🔥 普通',
    'PLAYER 1': '玩家 1', 'PLAYER 2': '玩家 2', 'throw (tap) · lob (hold)': '扔（点）· 高抛（按住）',
    'scoop snow (hold)': '捏雪球（按住）', 'special ⭐': '必杀技 ⭐',
    "Steer with the stick. Tap ❄️ to throw, hold it to lob over forts. Hold 🤲 to scoop snow. Tap your brother's face to call him!":
      '用摇杆走路。点 ❄️ 扔雪球，按住再松开是高抛，能飞过雪堡。按住 🤲 捏雪球。点兄弟的头像叫他来帮忙！',
    'made for': '送给', 'MAKING SNOW… ❄️': '正在下雪… ❄️', 'Turn sideways for a bigger yard ↻': '把屏幕横过来，院子更大 ↻',
    // select screen
    'PICK YOUR SNOWBALLERS': '选择打雪仗的人', 'WHO ARE YOU?': '你是谁？', 'PICK THE BROTHERS': '选择兄弟俩',
    'YOU': '你', '+ buddy': '+ 帮手', 'VS THE SNOW CREW': 'VS 雪人队',
    'snowmen and Bolt robots · 🐣 easy': '雪人和 Bolt 机器人 · 🐣 简单', 'snowmen and Bolt robots · 🔥 normal': '雪人和 Bolt 机器人 · 🔥 普通',
    'LET IT SNOW! ❄️': '开打！❄️', 'Tap the arrows to pick': '点箭头来选',
    'A D / ← → to pick · F or Enter to start · Esc to go back': 'A D / ← → 选人 · F 或回车开始 · Esc 返回',
    'A D: you · ← →: computer · F or Enter to start · Esc to go back': 'A D 选你 · ← → 选电脑 · F 或回车开始 · Esc 返回',
    'A D: player 1 · ← →: player 2 · F or Enter to start · Esc to go back': 'A D 选玩家 1 · ← → 选玩家 2 · F 或回车开始 · Esc 返回',
    'ZOMBIE': '僵尸', 'SNOWY': '小雪', 'CHILLY': '冰冰',
    // pause and results
    'RESTART': '重新开始', 'REMATCH': '再来一局', 'HITS': '打中', 'THROWS': '扔出', 'TREATS': '零食',
    'THE SNOW CREW WINS! TRY AGAIN!': '雪人队赢啦！再试一次！', 'THE BROTHERS': '兄弟俩', 'THE SNOW CREW': '雪人队',
    // the HUD
    'Pause (P)': '暂停 (P)', 'Sound (M)': '声音 (M)', 'Call your brother': '叫兄弟来帮忙',
    'NEXT HIT!': '决胜球！', '❄️ BIG': '❄️ 大雪球', 'CALL ME!': '叫我！', 'TAP: TREAT!': '再点：零食！', 'BYE!': '拜拜！',
    'BROTHER': '兄弟', 'SPECIAL': '必杀技', 'SCOOP': '捏雪球', 'THROW': '扔',
    // banners and toasts
    'SNOWBALL FIGHT!': '打雪仗开始！', 'FINAL ROUND': '决胜局', 'NEXT HIT WINS!': '下一球定胜负！',
    'THE FORTS ARE MELTING!': '雪堡在融化！', "TIME'S UP!": '时间到！', '⏰ 10 SECONDS LEFT!': '⏰ 还剩 10 秒！',
    'No snowballs! Hold 🤲 to scoop snow': '没有雪球啦！按住 🤲 捏雪球',
    'No snowballs! Hold G to scoop snow': '没有雪球啦！按住 G 捏雪球',
    'No snowballs! Hold K to scoop snow': '没有雪球啦！按住 K 捏雪球',
    'Hit snowballs to fill your ⭐ special!': '用雪球打中对手，攒满 ⭐ 必杀技！',
    // words drawn in 3D
    'SPLAT!': '啪！', 'BIG SPLAT!': '超级啪！', 'POOF!': '噗！', 'BOINK!': '咚！', 'SAVED!': '救到啦！', 'FSSS!': '嘶嘶！',
    'BRRR!': '好冷！', 'WHUMP!': '轰！', 'PEACE!': '比耶！', 'SWISH!': '唰！', 'BOP!': '砰！', 'THUD!': '咚！', 'BIG': '大',
    // the ? panel (js/keys.js)
    "The stick, ❄️ THROW, 🤲 SCOOP and ⭐ SPECIAL. Tap your brother's big face to call him.":
      '左边是摇杆，右边是 ❄️ 扔、🤲 捏雪球 和 ⭐ 必杀技。点兄弟的大头像叫他来帮忙。',
  });

  const t = (s) => L.t(s);
  const SPECIAL = {
    'BOXING FLURRY': '拳击连发', 'JUMP SHOT SLAM': '跳投大灌篮', 'PEACE SPREAD': '比耶散射', 'PEACE RAIN': '比耶雪雨',
    'ZOOM FLURRY': '飞速连发', 'MOON RAIN': '月亮雪雨', 'SNOW CANNON': '雪球大炮', 'BEAR SLAM': '熊熊大灌篮',
    'BOO-BALLS': '吓一跳雪球', AVALANCHE: '雪崩',
  };
  const POWER = { 'GIANT SNOWBALL!': '超大雪球！', 'TRIPLE THROW ×3!': '三连发 ×3！', 'FORT REBUILT!': '雪堡修好啦！', 'HOT COCOA SHIELD!': '热可可护盾！' };
  const TREAT = { 'ICE CREAM': '冰淇淋', WATER: '水', JUICE: '果汁', COOKIE: '饼干', WATERMELON: '西瓜', BANANA: '香蕉' };

  L.rule(/^FIRST TO (\d+) HITS · BEST OF 3$/, '先打中 $1 下 · 三局两胜');
  L.rule(/^FIRST TO (\d+) HITS$/, '先打中 $1 下');
  L.rule(/^RESTING (\d+)$/, '休息 $1');
  L.rule(/^ROUND (\d+)$/, '第 $1 局');
  L.rule(/^VS (.+)$/, (m, list) => 'VS ' + list.split(', ').map(t).join('、')); // the Snow Crew line-up in co-op
  L.rule(/^🥶 BRAIN FREEZE! (.+) IS DIZZY$/, (m, who) => `🥶 脑袋冻住啦！${t(who)} 晕乎乎`);
  L.rule(/^(.+) SAVED YOU!$/, (m, who) => `${t(who)} 救了你！`);
  L.rule(/^(.+) SAVED (.+)!$/, (m, who, whom) => `${t(who)} 救了 ${t(whom)}！`);
  L.rule(/^(.+) IS COMING! 🏃$/, (m, who) => `${t(who)} 来啦！🏃`);
  L.rule(/^(.+) is resting… (\d+) s$/, (m, who, s) => `${t(who)} 在休息… 还要 ${s} 秒`);
  L.rule(/^(\S+) (ICE CREAM|WATER|JUICE|COOKIE|WATERMELON|BANANA) FROM (.+)!$/, (m, e, item, who) => `${e} ${t(who)} 送来的${TREAT[item]}！`);
  L.rule(/^(\S+) (?:(.+): )?(GIANT SNOWBALL!|TRIPLE THROW ×3!|FORT REBUILT!|HOT COCOA SHIELD!)$/,
    (m, icon, who, what) => `${icon} ${who ? t(who) + '：' : ''}${POWER[what]}`);
  L.rule(/^(\S+) (BOXING FLURRY|JUMP SHOT SLAM|PEACE SPREAD|PEACE RAIN|ZOOM FLURRY|MOON RAIN|SNOW CANNON|BEAR SLAM|BOO-BALLS|AVALANCHE)!$/,
    (m, icon, name) => `${icon} ${SPECIAL[name]}！`);
  L.rule(/^(.+) WINS? THE ROUND!$/, (m, who) => `${t(who)} 赢了这一局！`);
  L.rule(/^(.+) WINS! GOOD TRY!$/, (m, who) => `${t(who)} 赢啦！下次加油！`);
  L.rule(/^(.+) WINS?!$/, (m, who) => `${t(who)} 赢啦！`);
})();
