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

// Tipos de tiro: o MESMO padrão de cooldown, só mudam as constantes.
const TIROS = {
  normal:   { tecla: "space", cooldown: 245,  width: 4,  height: 19, speed: 590, dano: 1, raio: 5,  perfura: false, cor: "#6d9fd8" },
  especial: { tecla: "x",     cooldown: 2000, width: 14, height: 42, speed: 680, dano: 3, raio: 12, perfura: true,  cor: "#cfe6ff" }
};
const ultimoUso = { normal: -Infinity, especial: -Infinity };

// Tipos de inimigo: um array só (asteroides), o tipo vive nos dados.
const TIPOS_INIMIGO = {
  rapido: { size: 34, r: 13, hp: 1, vel: 150, velOnda: 14, variacao: 30, pontos: 15, peso: 0.4, cor: "#e9b872" },
  lento:  { size: 78, r: 31, hp: 2, vel: 55,  velOnda: 8,  variacao: 15, pontos: 20, peso: 0.6, cor: "#8fb5df" }
};

class Asteroide {
  constructor(tipo) {
    const t = TIPOS_INIMIGO[tipo];
    this.tipo = tipo;
    this.width = this.height = t.size;
    this.r = t.r;
    this.hp = t.hp;
    this.pontos = t.pontos;
    this.cor = t.cor;
    this.x = t.size / 2 + Math.random() * (canvas.width - t.size);
    this.y = -t.size;
    this.speed = t.vel + wave * t.velOnda + Math.random() * t.variacao;
    this.rotation = (Math.random() - .5) * .35;
    this.spin = (Math.random() - .5) * .45;
  }
}

function sortearTipo() {
  let sorteio = Math.random();
  for (const [nome, t] of Object.entries(TIPOS_INIMIGO)) {
    if ((sorteio -= t.peso) < 0) return nome;
  }
  return "lento";
}
let tiros = [];
let asteroides = [];
let score = 0, lives = 3, wave = 1;
let pausado = false, gameOver = false;
let ultimoAsteroide = 0, tempoAnterior = 0;
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
  for(const [nome,cfg] of Object.entries(TIROS)){
    if(KEYS[cfg.tecla] && tempo-ultimoUso[nome]>cfg.cooldown){
      tiros.push({x:jogador.x+jogador.width/2-cfg.width/2,y:jogador.y+5,width:cfg.width,height:cfg.height,speed:cfg.speed,
        dano:cfg.dano,raio:cfg.raio,perfura:cfg.perfura,cor:cfg.cor,especial:nome==="especial",acertos:new Set()});
      ultimoUso[nome]=tempo;
    }
  }
}

function criarAsteroides(tempo) {
  const intervalo = Math.max(390, 1250 - wave * 85);
  if (tempo - ultimoAsteroide > intervalo) {
    asteroides.push(new Asteroide(sortearTipo()));
    ultimoAsteroide = tempo;
  }
}

function desenharTiros(delta) {
  for (let i = tiros.length - 1; i >= 0; i--) {
    const t = tiros[i];
    t.y -= t.speed * delta;
    ctx.fillStyle = t.cor;
    if (t.especial) { ctx.shadowColor = t.cor; ctx.shadowBlur = 14; }
    ctx.fillRect(t.x, t.y, t.width, t.height);
    ctx.shadowBlur = 0;
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

function criarExplosao(x,y,cor="#789fc9",qtd=8+Math.floor(Math.random()*5)){
  for(let n=0;n<qtd;n++){
    const ang=Math.random()*Math.PI*2,sp=60+Math.random()*180,vida=.3+Math.random()*.3;
    particulas.push({x,y,vx:Math.cos(ang)*sp,vy:Math.sin(ang)*sp,life:vida,max:vida,size:1+Math.random()*1.5,cor});
  }
}
function desenharParticulas(delta){
  for(const p of particulas){
    p.x+=p.vx*delta;p.y+=p.vy*delta;p.life-=delta;
    // faísca = traço curto na direção do movimento, some com a vida
    ctx.globalAlpha=Math.max(0,p.life/p.max);
    ctx.strokeStyle=p.cor;ctx.lineWidth=p.size;ctx.lineCap="round";
    ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(p.x-p.vx*.035,p.y-p.vy*.035);ctx.stroke();
  }
  ctx.globalAlpha=1;
  particulas=particulas.filter(p=>p.life>0);
}

function verificarColisoes(){
  for(let i=tiros.length-1;i>=0;i--){
    const t=tiros[i];
    for(let j=asteroides.length-1;j>=0;j--){
      const a=asteroides[j];
      if(t.acertos.has(a))continue;
      const dx=t.x+t.width/2-a.x,dy=t.y+t.height/2-a.y;
      if(Math.hypot(dx,dy)<a.r+t.raio){
        t.acertos.add(a);a.hp-=t.dano;
        if(a.hp<=0){
          criarExplosao(a.x,a.y,a.cor);asteroides.splice(j,1);
          score+=a.pontos;wave=Math.floor(score/100)+1;atualizarHUD();
        }else criarExplosao(a.x,a.y,a.cor,3);
        if(!t.perfura){tiros.splice(i,1);break;}
      }
    }
  }
}

function desenharRecarga(tempo){
  const cfg=TIROS.especial,pct=Math.min(1,(tempo-ultimoUso.especial)/cfg.cooldown),pronto=pct>=1;
  ctx.fillStyle="#9baabd";ctx.font="600 11px Arial";ctx.textAlign="left";
  ctx.fillText(pronto?"X  ESPECIAL PRONTO":"X  ESPECIAL",12,canvas.height-22);
  ctx.fillStyle="#13202e";ctx.fillRect(12,canvas.height-14,110,5);
  ctx.fillStyle=pronto?"#cfe6ff":"#4f78a8";ctx.fillRect(12,canvas.height-14,110*pct,5);
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
  ultimoUso.normal=-Infinity;ultimoUso.especial=-Infinity;ultimoAsteroide=0;atualizarHUD();
}

function jogo(tempo){
  const delta=Math.min((tempo-tempoAnterior)/1000,.05);tempoAnterior=tempo;
  desenharFundo(tempo,delta);
  if(gameOver){desenharMensagem("MISSÃO ENCERRADA","Pressione ENTER para tentar novamente");requestAnimationFrame(jogo);return;}
  if(pausado){desenharMensagem("JOGO PAUSADO","Pressione P para continuar");requestAnimationFrame(jogo);return;}
  movimentarJogador(delta);atirar(tempo);criarAsteroides(tempo);
  desenharTiros(delta);desenharAsteroides(delta);verificarColisoes();desenharParticulas(delta);desenharNave();desenharRecarga(tempo);
  requestAnimationFrame(jogo);
}
atualizarHUD();requestAnimationFrame(jogo);
