
const games = new Map();

function playerId(m){
 return m.key.participant || m.key.remoteJid;
}

module.exports = {
 name:'squid',
 async execute(sock,m,from,args){
  const sub=(args[0]||'').toLowerCase();

  if(sub==='create'){
    games.set(from,{
      registration:true,
      active:false,
      round:0,
      phase:'registration',
      players:[],
      eliminated:[],
      green:true
    });

    sock.sendMessage(from,{text:`🦑 SQUID GAME CREATED

⏰ Registration: 10 Minutes
Use .squid join

Registration closes automatically.`});

    setTimeout(async()=>{
      const g=games.get(from);
      if(!g) return;
      g.registration=false;
      g.active=true;
      g.round=1;
      g.phase='redlight';

      await sock.sendMessage(from,{text:`🚨 REGISTRATION CLOSED

👥 Players: ${g.players.length}

🟢🔴 ROUND 1
RED LIGHT GREEN LIGHT

✅ Use .run during GREEN LIGHT
❌ Don't use .run during RED LIGHT

⏰ Round Time: 60 Seconds`});

      let flips=0;
      const timer=setInterval(async()=>{
        if(!games.get(from) || games.get(from).round!==1){clearInterval(timer);return;}
        g.green=!g.green;
        await sock.sendMessage(from,{text:g.green?'🟢 GREEN LIGHT':'🔴 RED LIGHT'});
        flips++;
        if(flips>=12) clearInterval(timer);
      },5000);

      setTimeout(async()=>{
        if(!games.get(from)) return;
        const qualified=[];
        const failed=[];
        g.players.forEach(p=>{
          if((p.steps||0)>=10) qualified.push(p);
          else failed.push(p);
        });
        g.players=qualified;
        g.eliminated.push(...failed);
        await sock.sendMessage(from,{text:`🚨 ROUND 1 COMPLETE

☠️ Eliminated: ${failed.length}
🟢 Qualified: ${qualified.length}

👥 Remaining Players: ${qualified.length}

🍪 ROUND 2: DALGONA

Starts in 30 seconds...`});

        setTimeout(async()=>{
          if(!games.get(from)) return;
          g.round=2;
          g.phase='dalgona';
          await sock.sendMessage(from,{text:`🍪 ROUND 2 - DALGONA

✅ Use .cut A .cut B .cut C or .cut D
⏰ Time Limit: 45 Seconds

Choose carefully.`});
        },30000);

      },60000);

    },600000);

    return;
  }

  const g=games.get(from);
  if(!g) return sock.sendMessage(from,{text:'Use .squid create'});

  const pid=playerId(m);

  if(sub==='join'){
    if(!g.registration) return sock.sendMessage(from,{text:'Registration closed'});
    if(g.players.find(x=>x.id===pid)) return sock.sendMessage(from,{text:'Already joined'});

    g.players.push({id:pid,name:m.pushName||'Player',steps:0});
    return sock.sendMessage(from,{text:`✅ Joined\nPlayers: ${g.players.length}`});
  }

  if(sub==='run'){
    if(g.round!==1) return;
    const p=g.players.find(x=>x.id===pid);
    if(!p) return;

    if(!g.green){
      g.players=g.players.filter(x=>x.id!==pid);
      g.eliminated.push(p);

      return sock.sendMessage(from,{text:`☠️ ELIMINATED

${p.name} moved during RED LIGHT.

👥 Remaining Players: ${g.players.length}`});
    }

    p.steps+=1;

    return sock.sendMessage(from,{text:`🏃 ${p.name}
Progress: ${p.steps}/10`});
  }

  if(sub==='status'){
    return sock.sendMessage(from,{text:`Round: ${g.round}
Alive: ${g.players.length}
Eliminated: ${g.eliminated.length}`});
  }

  if(sub==='players' || sub==='remaining'){
    return sock.sendMessage(from,{text:`🟢 Remaining Players: ${g.players.length}`});
  }

  if(sub==='end'){
    games.delete(from);
    return sock.sendMessage(from,{text:'🏆 Game ended'});
  }
 }
}


// PHASE 2 NOTES ADDED
// After Round 1, survivors should advance to Dalgona.
// Dalgona timer: 45 seconds
// Commands:
// .cut A
// .cut B
// .cut C
// .cut D
// Wrong choice => eliminate player
// No answer before timeout => eliminate player


// ===== DALGONA PHASE SUPPORT =====
// Expected usage when round === 2:
// .cut A .cut B .cut C .cut D
// One option should be marked correct per player.
// Wrong answer => eliminate player.
// No answer within 45s => eliminate player.
// After Dalgona ends:
// announce survivors
// start Tug Of War after 30s.
