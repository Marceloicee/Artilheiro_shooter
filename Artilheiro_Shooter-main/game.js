const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");
const scoreEl = document.getElementById("score");
const livesEl = document.getElementById("lives");
const waveEl = document.getElementById("wave");

const KEYS = {};
const naveSprite = new Image();
naveSprite.src = "assets/nave.png";
const cometaSprite = new Image();
cometaSprite.src = "assets/image.png";

const jogador = { x: 208, y: 540, width: 64, height: 76, speed: 310 };
let tiros = [];
let asteroides = [];
let score = 0, lives = 3, wave = 1;
let pausado = false, gameOver = false;
let ultimoTiro = 0, ultimoAsteroide = 0, tempoAnterior = 0;
let estrelas = [];
let particulas = [];

function criarEstrelas() {
  estrelas = Array.from({length:115}, () => ({
    x:Math.random()*canvas.width, y:Math.random()*canvas.height,
    size:Math.random()*1.7+.35, speed:12+Math.random()*42,
    alpha:.25+Math.random()*.7, phase:Math.random()*Math.PI*2
  }));
}
criarEstrelas();

function atualizarHUD() {
  scoreEl.textContent = score;
  livesEl.textContent = lives;
  waveEl.textContent = wave;
}

document.addEventListener("keydown", e => {
  const key = e.key.toLowerCase();
  KEYS[key] = true;
  if (e.code === "Space") { KEYS.space = true; e.preventDefault(); }
  if (["arrowleft","arrowright"].includes(key)) e.preventDefault();
  if (key === "p" && !gameOver) pausado = !pausado;
  if (key === "enter" && gameOver) reiniciar();
});
document.addEventListener("keyup", e => {
  KEYS[e.key.toLowerCase()] = false;
  if (e.code === "Space") KEYS.space = false;
});

function desenharFundo(tempo, delta) {
  // Espaço completamente preto, com estrelas discretas.
  ctx.fillStyle = "#000000";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (const s of estrelas) {
    s.y += s.speed * delta;
    if (s.y > canvas.height) {
      s.y = 0;
      s.x = Math.random() * canvas.width;
    }
    const twinkle = .72 + .28 * Math.sin(tempo * .0015 + s.phase);
    ctx.globalAlpha = s.alpha * twinkle;
    ctx.fillStyle = "#b8c9dc";
    ctx.beginPath();
    ctx.arc(s.x, s.y, Math.max(.45, s.size * .65), 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function desenharNave() {
  if (naveSprite.complete && naveSprite.naturalWidth) {
    ctx.drawImage(naveSprite, jogador.x, jogador.y, jogador.width, jogador.height);
  } else {
    ctx.fillStyle = "#6d9fd8";
    ctx.beginPath();
    ctx.moveTo(jogador.x + 32, jogador.y);
    ctx.lineTo(jogador.x + 60, jogador.y + 70);
    ctx.lineTo(jogador.x + 32, jogador.y + 57);
    ctx.lineTo(jogador.x + 4, jogador.y + 70);
    ctx.closePath();
    ctx.fill();
  }
}

function movimentarJogador(delta){
  if(KEYS.arrowleft||KEYS.a) jogador.x-=jogador.speed*delta;
  if(KEYS.arrowright||KEYS.d) jogador.x+=jogador.speed*delta;
  jogador.x=Math.max(0,Math.min(canvas.width-jogador.width,jogador.x));
}

function atirar(tempo){
  if(KEYS.space && tempo-ultimoTiro>245){
    tiros.push({x:jogador.x+jogador.width/2-2,y:jogador.y+5,width:4,height:19,speed:590});
    ultimoTiro=tempo;
  }
}

function criarAsteroides(tempo) {
  const intervalo = Math.max(390, 1250 - wave * 85);
  if (tempo - ultimoAsteroide > intervalo) {
    const size = 48;
    asteroides.push({
      x: size / 2 + Math.random() * (canvas.width - size),
      y: -size,
      width: size,
      height: size,
      r: 19,
      speed: 82 + wave * 13 + Math.random() * 30,
      rotation: (Math.random() - .5) * .35,
      spin: (Math.random() - .5) * .45
    });
    ultimoAsteroide = tempo;
  }
}

function desenharTiros(delta) {
  for (let i = tiros.length - 1; i >= 0; i--) {
    const t = tiros[i];
    t.y -= t.speed * delta;
    ctx.fillStyle = "#6d9fd8";
    ctx.fillRect(t.x, t.y, t.width, t.height);
    if (t.y + t.height < 0) tiros.splice(i, 1);
  }
}

function desenharAsteroides(delta) {
  for (let i = asteroides.length - 1; i >= 0; i--) {
    const a = asteroides[i];
    a.y += a.speed * delta;
    a.rotation += a.spin * delta;

    if (cometaSprite.complete && cometaSprite.naturalWidth) {
      ctx.save();
      ctx.translate(a.x, a.y);
      ctx.rotate(a.rotation);
      ctx.drawImage(cometaSprite, -a.width / 2, -a.height / 2, a.width, a.height);
      ctx.restore();
    }

    if (a.y - a.height / 2 > canvas.height) {
      asteroides.splice(i, 1);
      lives--;
      atualizarHUD();
      if (lives <= 0) gameOver = true;
    }
  }
}

function criarExplosao(x,y){
  for(let n=0;n<12;n++){const ang=Math.random()*Math.PI*2,sp=35+Math.random()*130;particulas.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:.45,max:.45,size:1+Math.random()*2.5});}
}
function desenharParticulas(delta){
  for(let i=particulas.length-1;i>=0;i--){const p=particulas[i];p.x+=p.vx*delta;p.y+=p.vy*delta;p.life-=delta;
    ctx.globalAlpha=Math.max(0,p.life/p.max);ctx.fillStyle="#789fc9";ctx.beginPath();ctx.arc(p.x,p.y,p.size,0,Math.PI*2);ctx.fill();ctx.globalAlpha=1;
    if(p.life<=0)particulas.splice(i,1);
  }
}

function verificarColisoes(){
  for(let i=tiros.length-1;i>=0;i--){
    const t=tiros[i];let atingiu=false;
    for(let j=asteroides.length-1;j>=0;j--){
      const a=asteroides[j];
      const dx=t.x+t.width/2-a.x,dy=t.y+t.height/2-a.y;
      if(Math.hypot(dx,dy)<a.r+5){
        criarExplosao(a.x,a.y);tiros.splice(i,1);asteroides.splice(j,1);
        score+=10;wave=Math.floor(score/100)+1;atualizarHUD();atingiu=true;break;
      }
    }
    if(atingiu)continue;
  }
}

function desenharMensagem(titulo,subtitulo){
  ctx.fillStyle="rgba(1,4,13,.82)";ctx.fillRect(0,0,canvas.width,canvas.height);
  ctx.textAlign = "center";
  ctx.fillStyle = "#8fb5df";
  ctx.font = "600 30px Arial";
  ctx.fillText(titulo, canvas.width / 2, 280);
  ctx.fillStyle = "#d7e0eb";
  ctx.font = "15px Arial";
  ctx.fillText(subtitulo, canvas.width / 2, 325);
}
function reiniciar(){
  jogador.x=208;tiros=[];asteroides=[];particulas=[];
  score=0;lives=3;wave=1;pausado=false;gameOver=false;
  ultimoTiro=0;ultimoAsteroide=0;atualizarHUD();
}

function jogo(tempo){
  const delta=Math.min((tempo-tempoAnterior)/1000,.05);tempoAnterior=tempo;
  desenharFundo(tempo,delta);
  if(gameOver){desenharMensagem("MISSÃO ENCERRADA","Pressione ENTER para tentar novamente");requestAnimationFrame(jogo);return;}
  if(pausado){desenharMensagem("JOGO PAUSADO","Pressione P para continuar");requestAnimationFrame(jogo);return;}
  movimentarJogador(delta);atirar(tempo);criarAsteroides(tempo);
  desenharTiros(delta);desenharAsteroides(delta);verificarColisoes();desenharParticulas(delta);desenharNave();
  requestAnimationFrame(jogo);
}
atualizarHUD();requestAnimationFrame(jogo);
