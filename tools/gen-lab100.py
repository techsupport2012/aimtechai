#!/usr/bin/env python3
"""Generate /studiolab-100.html with 100 compact CSS/JS experiments."""
import pathlib

OUT = pathlib.Path(__file__).parent.parent / 'public' / 'studiolab-100.html'

# Each entry: (num, cat, title, desc, html, css, js)
# Kept compact; many are pure CSS with no JS.
E = []

def add(num, cat, title, desc, html, css, js=''):
    E.append((num, cat, title, desc, html, css, js))

# ==================== TEXT EFFECTS (10) ====================
add(42,'Text','Glitch Text','RGB shift + clip-path slice',
    '<div class="x42"><span data-t="AIM TECH AI">AIM TECH AI</span></div>',
    '.x42{text-align:center;padding:3rem;font-size:2.5rem;font-weight:900;letter-spacing:4px}'
    '.x42 span{position:relative;color:#fff}'
    '.x42 span::before,.x42 span::after{content:attr(data-t);position:absolute;inset:0}'
    '.x42 span::before{color:#ff3c78;transform:translate(-2px,0);clip-path:polygon(0 0,100% 0,100% 45%,0 45%);animation:gl1 2s infinite}'
    '.x42 span::after{color:#0FC1B7;transform:translate(2px,0);clip-path:polygon(0 55%,100% 55%,100% 100%,0 100%);animation:gl2 2s infinite}'
    '@keyframes gl1{0%,90%{transform:translate(-2px,0)}95%{transform:translate(-6px,2px)}100%{transform:translate(-2px,0)}}'
    '@keyframes gl2{0%,90%{transform:translate(2px,0)}95%{transform:translate(6px,-2px)}100%{transform:translate(2px,0)}}')

add(43,'Text','Outline Stroke','Text stroke no fill',
    '<div class="x43">SYSTEMS</div>',
    '.x43{text-align:center;padding:3rem;font-size:4rem;font-weight:900;color:transparent;-webkit-text-stroke:2px #0FC1B7;letter-spacing:2px}')

add(44,'Text','Gradient Fill','Teal gradient clip',
    '<div class="x44">GRADIENT</div>',
    '.x44{text-align:center;padding:3rem;font-size:4rem;font-weight:900;background:linear-gradient(45deg,#0FC1B7,#7EE8FA,#2A354B);-webkit-background-clip:text;background-clip:text;color:transparent;letter-spacing:1px}')

add(45,'Text','Image Mask','Text with image background',
    '<div class="x45">GLOW</div>',
    '.x45{text-align:center;padding:3rem;font-size:5rem;font-weight:900;background:radial-gradient(circle at 30% 30%,#0FC1B7,#2A354B);-webkit-background-clip:text;background-clip:text;color:transparent;filter:drop-shadow(0 0 30px rgba(15,193,183,0.4))}')

add(46,'Text','Shadow Pop','Deep long shadow',
    '<div class="x46">POP</div>',
    '.x46{text-align:center;padding:3rem;font-size:5rem;font-weight:900;color:#0FC1B7}'
    '.x46{text-shadow:1px 1px 0 #0DAFA6,2px 2px 0 #0A9B92,3px 3px 0 #087a73,4px 4px 0 #065e58,5px 5px 0 #04423d,6px 6px 10px rgba(0,0,0,0.5)}')

add(47,'Text','Mirror Reflection','Flipped gradient beneath',
    '<div class="x47"><span>MIRROR</span><span class="r">MIRROR</span></div>',
    '.x47{text-align:center;padding:2rem;font-size:3.5rem;font-weight:900;color:#fff;line-height:1}'
    '.x47 .r{display:block;transform:scaleY(-1);background:linear-gradient(180deg,transparent 0%,rgba(255,255,255,0.25) 70%,rgba(255,255,255,0.05));-webkit-background-clip:text;background-clip:text;color:transparent;filter:blur(0.5px);margin-top:-0.2em}')

add(48,'Text','Cursor Blink','Terminal-style blink',
    '<div class="x48">prompt &gt; <span></span></div>',
    '.x48{text-align:center;padding:3rem;font-family:var(--font-mono);font-size:1.4rem;color:#0FC1B7}'
    '.x48 span{display:inline-block;width:12px;height:1.2em;background:#0FC1B7;vertical-align:middle;animation:bl48 0.7s steps(1) infinite}'
    '@keyframes bl48{0%,50%{opacity:1}50.01%,100%{opacity:0}}')

add(49,'Text','Wavy Text','Letters on sine wave',
    '<div class="x49"><span>W</span><span>A</span><span>V</span><span>Y</span><span>!</span></div>',
    '.x49{text-align:center;padding:3rem;font-size:3rem;font-weight:900;color:#0FC1B7}'
    '.x49 span{display:inline-block;animation:wv49 2s ease-in-out infinite}'
    '.x49 span:nth-child(2){animation-delay:0.1s}.x49 span:nth-child(3){animation-delay:0.2s}.x49 span:nth-child(4){animation-delay:0.3s}.x49 span:nth-child(5){animation-delay:0.4s}'
    '@keyframes wv49{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}')

add(50,'Text','Rainbow Text','Hue-rotate animation',
    '<div class="x50">PRISMATIC</div>',
    '.x50{text-align:center;padding:3rem;font-size:3.5rem;font-weight:900;background:linear-gradient(90deg,#ff3c78,#ffb347,#ffe066,#0FC1B7,#7EE8FA,#a14eff);-webkit-background-clip:text;background-clip:text;color:transparent;animation:rb50 4s linear infinite;background-size:200% 100%}'
    '@keyframes rb50{from{background-position:0 0}to{background-position:200% 0}}')

add(51,'Text','3D Perspective','Rotated in Z-space',
    '<div class="x51"><span>DEPTH</span></div>',
    '.x51{text-align:center;padding:3rem;perspective:400px}'
    '.x51 span{display:inline-block;font-size:4rem;font-weight:900;color:#0FC1B7;transform:rotateX(15deg) rotateY(-20deg);text-shadow:2px 2px 0 #0DAFA6,4px 4px 0 #2A354B,6px 6px 20px rgba(0,0,0,0.5)}')

# ==================== BUTTONS (10) ====================
add(52,'Button','Liquid Fill','Background sweeps across',
    '<div class="x52"><button>Click Me</button></div>',
    '.x52{text-align:center;padding:3rem}'
    '.x52 button{position:relative;padding:0.8rem 2rem;font-size:0.95rem;font-weight:600;color:#0FC1B7;background:transparent;border:2px solid #0FC1B7;border-radius:30px;cursor:pointer;overflow:hidden;transition:color 0.4s}'
    '.x52 button::before{content:"";position:absolute;inset:0;background:#0FC1B7;transform:translateX(-100%);transition:transform 0.4s cubic-bezier(0.16,1,0.3,1)}'
    '.x52 button:hover{color:#0a0608}.x52 button:hover::before{transform:translateX(0)}'
    '.x52 button span,.x52 button{position:relative;z-index:1}'
    '.x52 button::before{z-index:0}')

add(53,'Button','Neon Glow','Shadow-pulse on hover',
    '<div class="x53"><button>Ignite</button></div>',
    '.x53{text-align:center;padding:3rem}'
    '.x53 button{padding:0.9rem 2.5rem;font-size:1rem;font-weight:700;color:#0FC1B7;background:transparent;border:2px solid #0FC1B7;border-radius:8px;cursor:pointer;letter-spacing:2px;text-transform:uppercase;transition:all 0.3s}'
    '.x53 button:hover{background:#0FC1B7;color:#0a0608;box-shadow:0 0 30px #0FC1B7,0 0 60px rgba(15,193,183,0.5),inset 0 0 20px rgba(255,255,255,0.3)}')

add(54,'Button','Split Halves','Two-tone split',
    '<div class="x54"><button><span class="a">Buy</span><span class="b">$29</span></button></div>',
    '.x54{text-align:center;padding:3rem}'
    '.x54 button{display:inline-flex;border:none;border-radius:30px;overflow:hidden;font-size:0.95rem;font-weight:600;cursor:pointer}'
    '.x54 .a{padding:0.8rem 1.5rem;background:#0FC1B7;color:#0a0608}'
    '.x54 .b{padding:0.8rem 1.5rem;background:#2A354B;color:#0FC1B7}')

add(55,'Button','Gradient Border','Padding trick for gradient',
    '<div class="x55"><button>Gradient Edge</button></div>',
    '.x55{text-align:center;padding:3rem}'
    '.x55 button{position:relative;padding:0.9rem 2rem;font-size:0.95rem;font-weight:700;color:#fff;background:#0a0608;border:none;border-radius:30px;cursor:pointer;background-clip:padding-box}'
    '.x55 button::before{content:"";position:absolute;inset:0;padding:2px;border-radius:30px;background:linear-gradient(45deg,#0FC1B7,#7EE8FA,#2A354B);-webkit-mask:linear-gradient(#fff 0 0) content-box,linear-gradient(#fff 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}')

add(56,'Button','Icon Slide','Icon slides in on hover',
    '<div class="x56"><button><span class="t">Continue</span><span class="i">&rarr;</span></button></div>',
    '.x56{text-align:center;padding:3rem}'
    '.x56 button{display:inline-flex;align-items:center;gap:0.5rem;padding:0.8rem 1.8rem;font-size:0.95rem;font-weight:600;color:#0a0608;background:#0FC1B7;border:none;border-radius:8px;cursor:pointer;overflow:hidden}'
    '.x56 .i{display:inline-block;transform:translateX(-20px);opacity:0;transition:all 0.3s cubic-bezier(0.16,1,0.3,1)}'
    '.x56 button:hover .i{transform:translateX(0);opacity:1}')

add(57,'Button','Squish Press','Scale down on click',
    '<div class="x57"><button>Tap Me</button></div>',
    '.x57{text-align:center;padding:3rem}'
    '.x57 button{padding:1rem 2rem;font-size:1rem;font-weight:700;color:#0a0608;background:#0FC1B7;border:none;border-radius:12px;cursor:pointer;transition:transform 0.1s cubic-bezier(0.16,1,0.3,1);box-shadow:0 6px 0 #0A9B92}'
    '.x57 button:active{transform:translateY(4px);box-shadow:0 2px 0 #0A9B92}')

add(58,'Button','3D Extrude','Hard shadow stack',
    '<div class="x58"><button>Extruded</button></div>',
    '.x58{text-align:center;padding:3rem}'
    '.x58 button{padding:1rem 2rem;font-size:1rem;font-weight:700;color:#fff;background:#0FC1B7;border:none;border-radius:6px;cursor:pointer;box-shadow:1px 1px 0 #0DAFA6,2px 2px 0 #0A9B92,3px 3px 0 #087a73,4px 4px 0 #065e58,5px 5px 0 #04423d,6px 6px 0 #2A354B}'
    '.x58 button:active{transform:translate(3px,3px);box-shadow:1px 1px 0 #0DAFA6,2px 2px 0 #0A9B92}')

add(59,'Button','Cut Corner','Clipped corners',
    '<div class="x59"><button>Cyber</button></div>',
    '.x59{text-align:center;padding:3rem}'
    '.x59 button{padding:1rem 2.5rem;font-size:0.95rem;font-weight:700;color:#0FC1B7;background:rgba(15,193,183,0.1);border:1px solid #0FC1B7;cursor:pointer;letter-spacing:3px;text-transform:uppercase;clip-path:polygon(10px 0,100% 0,100% calc(100% - 10px),calc(100% - 10px) 100%,0 100%,0 10px)}'
    '.x59 button:hover{background:#0FC1B7;color:#0a0608}')

add(60,'Button','Loading Dots','Ellipsis loader',
    '<div class="x60"><button>Submit<span></span><span></span><span></span></button></div>',
    '.x60{text-align:center;padding:3rem}'
    '.x60 button{padding:1rem 2rem;font-size:1rem;font-weight:700;color:#0a0608;background:#0FC1B7;border:none;border-radius:8px;cursor:pointer;display:inline-flex;align-items:center;gap:0.4rem}'
    '.x60 span{display:inline-block;width:6px;height:6px;border-radius:50%;background:#0a0608;animation:dt60 1s ease-in-out infinite}'
    '.x60 span:nth-child(2){animation-delay:0.2s}.x60 span:nth-child(3){animation-delay:0.4s}'
    '@keyframes dt60{0%,60%,100%{opacity:0.3;transform:translateY(0)}30%{opacity:1;transform:translateY(-4px)}}')

add(61,'Button','Arrow Draw','SVG stroke-dasharray',
    '<div class="x61"><button><span>Draw</span><svg viewBox="0 0 100 100"><rect x="2" y="2" width="96" height="96" rx="8" fill="none" stroke="#0FC1B7" stroke-width="2"/></svg></button></div>',
    '.x61{text-align:center;padding:3rem}'
    '.x61 button{position:relative;padding:1rem 2rem;font-size:1rem;font-weight:700;color:#0FC1B7;background:transparent;border:none;cursor:pointer}'
    '.x61 svg{position:absolute;inset:0;width:100%;height:100%}'
    '.x61 rect{stroke-dasharray:400;stroke-dashoffset:400;transition:stroke-dashoffset 0.8s}'
    '.x61 button:hover rect{stroke-dashoffset:0}')

# ==================== LOADERS (10) ====================
add(62,'Loader','Ring Spinner','Classic rotating ring',
    '<div class="x62"><div class="s"></div></div>',
    '.x62{display:flex;justify-content:center;padding:3rem}'
    '.x62 .s{width:48px;height:48px;border:4px solid rgba(15,193,183,0.2);border-top-color:#0FC1B7;border-radius:50%;animation:sp62 0.9s linear infinite}'
    '@keyframes sp62{to{transform:rotate(360deg)}}')

add(63,'Loader','Pulse Dots','3 dots pulsing',
    '<div class="x63"><span></span><span></span><span></span></div>',
    '.x63{display:flex;gap:8px;justify-content:center;padding:3rem}'
    '.x63 span{width:14px;height:14px;background:#0FC1B7;border-radius:50%;animation:pu63 1.4s ease-in-out infinite}'
    '.x63 span:nth-child(2){animation-delay:-0.32s}.x63 span:nth-child(3){animation-delay:-0.16s}'
    '@keyframes pu63{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}')

add(64,'Loader','Wave Bars','Equalizer-style bars',
    '<div class="x64"><i></i><i></i><i></i><i></i><i></i></div>',
    '.x64{display:flex;gap:4px;justify-content:center;align-items:flex-end;padding:3rem;height:100px}'
    '.x64 i{display:block;width:6px;height:100%;background:#0FC1B7;animation:bar64 1.2s ease-in-out infinite}'
    '.x64 i:nth-child(2){animation-delay:0.1s}.x64 i:nth-child(3){animation-delay:0.2s}.x64 i:nth-child(4){animation-delay:0.3s}.x64 i:nth-child(5){animation-delay:0.4s}'
    '@keyframes bar64{0%,100%{transform:scaleY(0.3)}50%{transform:scaleY(1)}}')

add(65,'Loader','Rotating Square','Box spinning and flipping',
    '<div class="x65"><div class="b"></div></div>',
    '.x65{display:flex;justify-content:center;padding:3rem}'
    '.x65 .b{width:40px;height:40px;background:#0FC1B7;animation:sq65 1.6s infinite}'
    '@keyframes sq65{0%{transform:rotate(0) scale(1)}50%{transform:rotate(180deg) scale(0.6)}100%{transform:rotate(360deg) scale(1)}}')

add(66,'Loader','Infinity Loop','∞ path animation',
    '<div class="x66"><svg viewBox="0 0 200 100"><path d="M50,50 C50,10 100,10 100,50 C100,90 150,90 150,50 C150,10 100,10 100,50 C100,90 50,90 50,50 Z" fill="none" stroke="#0FC1B7" stroke-width="4"/></svg></div>',
    '.x66{display:flex;justify-content:center;padding:3rem}'
    '.x66 svg{width:120px;height:60px}'
    '.x66 path{stroke-dasharray:200;stroke-dashoffset:0;animation:in66 2s linear infinite}'
    '@keyframes in66{to{stroke-dashoffset:-400}}')

add(67,'Loader','Progress Bar','Indeterminate stripe',
    '<div class="x67"><div class="t"><div class="f"></div></div></div>',
    '.x67{padding:3rem 10%}'
    '.x67 .t{height:6px;background:rgba(15,193,183,0.15);border-radius:3px;overflow:hidden;position:relative}'
    '.x67 .f{position:absolute;top:0;left:-30%;width:30%;height:100%;background:#0FC1B7;border-radius:3px;animation:pr67 1.5s ease-in-out infinite}'
    '@keyframes pr67{0%{left:-30%}100%{left:100%}}')

add(68,'Loader','Skeleton','Shimmer skeleton box',
    '<div class="x68"><div class="line"></div><div class="line short"></div><div class="line"></div></div>',
    '.x68{padding:3rem 10%}'
    '.x68 .line{height:14px;background:linear-gradient(90deg,rgba(255,255,255,0.05) 0%,rgba(15,193,183,0.25) 50%,rgba(255,255,255,0.05) 100%);background-size:200% 100%;border-radius:6px;margin-bottom:10px;animation:sk68 1.5s linear infinite}'
    '.x68 .short{width:60%}'
    '@keyframes sk68{from{background-position:200% 0}to{background-position:-200% 0}}')

add(69,'Loader','Liquid Drop','Morphing blob',
    '<div class="x69"><div class="d"></div></div>',
    '.x69{display:flex;justify-content:center;padding:3rem}'
    '.x69 .d{width:50px;height:50px;background:#0FC1B7;border-radius:50%;animation:dr69 2s ease-in-out infinite}'
    '@keyframes dr69{0%,100%{border-radius:50%;transform:scale(1)}25%{border-radius:40% 60% 60% 40%;transform:scale(1.1)}50%{border-radius:30% 70% 70% 30%;transform:scale(0.9)}75%{border-radius:60% 40% 40% 60%;transform:scale(1.05)}}')

add(70,'Loader','Orbit','Dot orbiting another',
    '<div class="x70"><div class="o"><div class="p"></div></div></div>',
    '.x70{display:flex;justify-content:center;padding:3rem}'
    '.x70 .o{width:60px;height:60px;border:2px dashed rgba(15,193,183,0.3);border-radius:50%;position:relative;animation:or70 2s linear infinite}'
    '.x70 .p{position:absolute;width:12px;height:12px;background:#0FC1B7;border-radius:50%;top:-6px;left:50%;transform:translateX(-50%);box-shadow:0 0 12px #0FC1B7}'
    '@keyframes or70{to{transform:rotate(360deg)}}')

add(71,'Loader','Fill Bar','Width grows with gradient',
    '<div class="x71"><div class="t"><div class="f"></div></div></div>',
    '.x71{padding:3rem 10%}'
    '.x71 .t{height:8px;background:rgba(255,255,255,0.08);border-radius:4px;overflow:hidden}'
    '.x71 .f{height:100%;background:linear-gradient(90deg,#0FC1B7,#7EE8FA,#0FC1B7);background-size:200% 100%;border-radius:4px;animation:fb71 3s ease-out infinite}'
    '@keyframes fb71{0%{width:0;background-position:0 0}100%{width:100%;background-position:200% 0}}')

# ==================== BACKGROUNDS (10) ====================
add(72,'BG','Dot Grid','Tiny radial dot pattern',
    '<div class="x72"></div>',
    '.x72{height:200px;background-image:radial-gradient(circle,rgba(15,193,183,0.4) 1px,transparent 1.5px);background-size:20px 20px;border-radius:16px;margin:1rem 0}')

add(73,'BG','Diagonal Stripes','Repeating linear gradient',
    '<div class="x73"></div>',
    '.x73{height:200px;background:repeating-linear-gradient(45deg,rgba(15,193,183,0.2) 0 20px,rgba(42,53,75,0.4) 20px 40px);border-radius:16px;margin:1rem 0}')

add(74,'BG','Checkerboard','Two-color tiles',
    '<div class="x74"></div>',
    '.x74{height:200px;background-image:conic-gradient(#0FC1B7 0 25%,#2A354B 0 50%,#0FC1B7 0 75%,#2A354B 0);background-size:40px 40px;border-radius:16px;margin:1rem 0;animation:ck74 8s linear infinite}'
    '@keyframes ck74{to{background-position:40px 0}}')

add(75,'BG','Hex Honeycomb','SVG hex grid',
    '<div class="x75"></div>',
    '.x75{height:200px;background:url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'56\' height=\'100\'><polygon points=\'28,0 56,16 56,48 28,64 0,48 0,16\' fill=\'none\' stroke=\'%230FC1B7\' stroke-opacity=\'0.3\'/></svg>");background-size:56px 64px;border-radius:16px;margin:1rem 0}')

add(76,'BG','Scan Lines','Horizontal CRT lines',
    '<div class="x76"></div>',
    '.x76{height:200px;background:linear-gradient(180deg,#0a1628,#0a0608),repeating-linear-gradient(0deg,rgba(15,193,183,0.15) 0 2px,transparent 2px 4px);background-blend-mode:overlay;border-radius:16px;margin:1rem 0}')

add(77,'BG','Radial Glow','Centered spotlight',
    '<div class="x77"></div>',
    '.x77{height:200px;background:radial-gradient(ellipse at center,#0FC1B7 0%,#0a0608 70%);border-radius:16px;margin:1rem 0}')

add(78,'BG','Twinkle','Small sparkles',
    '<div class="x78"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
    '.x78{position:relative;height:200px;background:#0a0608;border-radius:16px;margin:1rem 0;overflow:hidden}'
    '.x78 i{position:absolute;width:3px;height:3px;background:#fff;border-radius:50%;box-shadow:0 0 4px #fff;animation:tw78 2s ease-in-out infinite}'
    '.x78 i:nth-child(1){top:20%;left:10%}.x78 i:nth-child(2){top:60%;left:25%;animation-delay:0.3s}.x78 i:nth-child(3){top:40%;left:50%;animation-delay:0.6s}'
    '.x78 i:nth-child(4){top:80%;left:40%;animation-delay:0.9s}.x78 i:nth-child(5){top:15%;left:70%;animation-delay:1.2s}.x78 i:nth-child(6){top:55%;left:80%;animation-delay:1.5s}'
    '.x78 i:nth-child(7){top:30%;left:30%;animation-delay:0.15s}.x78 i:nth-child(8){top:70%;left:15%;animation-delay:0.45s}.x78 i:nth-child(9){top:25%;left:90%;animation-delay:0.75s}'
    '.x78 i:nth-child(10){top:85%;left:65%;animation-delay:1.05s}.x78 i:nth-child(11){top:50%;left:60%;animation-delay:1.35s}.x78 i:nth-child(12){top:10%;left:45%;animation-delay:1.65s}'
    '@keyframes tw78{0%,100%{opacity:0.2;transform:scale(1)}50%{opacity:1;transform:scale(1.8)}}')

add(79,'BG','Animated Stripes','Diagonal stripes moving',
    '<div class="x79"></div>',
    '.x79{height:200px;background:repeating-linear-gradient(135deg,#0FC1B7 0 20px,#0A9B92 20px 40px);background-size:56px 56px;border-radius:16px;margin:1rem 0;animation:st79 2s linear infinite}'
    '@keyframes st79{to{background-position:56px 0}}')

add(80,'BG','Film Grain','Noise overlay via SVG',
    '<div class="x80"></div>',
    '.x80{height:200px;background:linear-gradient(135deg,#0FC1B7,#2A354B),url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'200\' height=\'200\'><filter id=\'n\'><feTurbulence type=\'fractalNoise\' baseFrequency=\'0.9\'/></filter><rect width=\'100%\' height=\'100%\' filter=\'url(%23n)\' opacity=\'0.3\'/></svg>");background-blend-mode:overlay;border-radius:16px;margin:1rem 0}')

add(81,'BG','Matrix Scroll','Falling 1s and 0s',
    '<div class="x81" data-m></div>',
    '.x81{height:200px;background:#000;border-radius:16px;margin:1rem 0;overflow:hidden;font-family:monospace;color:#0FC1B7;font-size:14px;line-height:1;white-space:pre;padding:0.5rem;position:relative}')

# ==================== CARDS (10) ====================
add(82,'Card','Flip Stack','Multiple cards stacked behind',
    '<div class="x82"><div class="c"><div class="h">AIM</div><div class="b">Card Stack</div></div></div>',
    '.x82{display:flex;justify-content:center;padding:3rem}'
    '.x82 .c{position:relative;width:220px;height:140px;background:linear-gradient(135deg,#0FC1B7,#2A354B);border-radius:14px;padding:1.4rem;color:#fff;box-shadow:0 20px 40px rgba(0,0,0,0.4)}'
    '.x82 .c::before,.x82 .c::after{content:"";position:absolute;inset:0;border-radius:14px;background:inherit}'
    '.x82 .c::before{transform:translate(6px,6px) rotate(-4deg);z-index:-1;opacity:0.7}'
    '.x82 .c::after{transform:translate(12px,12px) rotate(-8deg);z-index:-2;opacity:0.4}'
    '.x82 .h{font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;text-transform:uppercase;margin-bottom:0.5rem}'
    '.x82 .b{font-size:1.4rem;font-weight:800}')

add(83,'Card','Peel Corner','Folded top-right corner',
    '<div class="x83"><div class="c"><div class="p"></div><div class="b">Peel me</div></div></div>',
    '.x83{display:flex;justify-content:center;padding:3rem}'
    '.x83 .c{position:relative;width:220px;height:160px;background:#0FC1B7;border-radius:14px;padding:1.4rem;color:#0a0608;font-weight:700;box-shadow:0 20px 40px rgba(0,0,0,0.3)}'
    '.x83 .p{position:absolute;top:0;right:0;width:40px;height:40px;background:linear-gradient(225deg,#0a0608 50%,#0A9B92 50%);border-radius:0 14px 0 14px;transition:all 0.3s cubic-bezier(0.16,1,0.3,1)}'
    '.x83 .c:hover .p{width:70px;height:70px}')

add(84,'Card','Border Trace','Light runs around border',
    '<div class="x84"><div class="c">Trace me</div></div>',
    '.x84{display:flex;justify-content:center;padding:3rem}'
    '.x84 .c{position:relative;padding:2rem 3rem;background:#0a0608;color:#fff;font-weight:700;border-radius:12px;overflow:hidden}'
    '.x84 .c::before{content:"";position:absolute;inset:-2px;background:conic-gradient(from var(--a,0deg),transparent 0deg,#0FC1B7 30deg,transparent 60deg);animation:tr84 3s linear infinite;z-index:0}'
    '.x84 .c::after{content:"";position:absolute;inset:2px;background:#0a0608;border-radius:10px;z-index:1}'
    '.x84 .c > *,.x84 .c{position:relative}'
    '@keyframes tr84{to{--a:360deg}}')

add(85,'Card','Zoom Hover','Image scales on hover',
    '<div class="x85"><div class="c"><div class="i"></div><div class="t">Discover</div></div></div>',
    '.x85{display:flex;justify-content:center;padding:3rem}'
    '.x85 .c{width:240px;height:160px;border-radius:14px;overflow:hidden;position:relative;cursor:pointer}'
    '.x85 .i{position:absolute;inset:0;background:radial-gradient(circle at 30% 40%,#0FC1B7,#2A354B);transition:transform 0.6s cubic-bezier(0.16,1,0.3,1)}'
    '.x85 .c:hover .i{transform:scale(1.15)}'
    '.x85 .t{position:absolute;bottom:1rem;left:1rem;color:#fff;font-weight:800;font-size:1.3rem;z-index:1}')

add(86,'Card','Reveal Overlay','Dark overlay on hover',
    '<div class="x86"><div class="c"><div class="b">Product</div><div class="o">Learn more &rarr;</div></div></div>',
    '.x86{display:flex;justify-content:center;padding:3rem}'
    '.x86 .c{position:relative;width:240px;height:160px;background:linear-gradient(135deg,#0FC1B7,#2A354B);border-radius:14px;overflow:hidden;cursor:pointer;padding:1.3rem;color:#fff;font-weight:800}'
    '.x86 .o{position:absolute;inset:0;display:flex;align-items:center;justify-content:center;background:rgba(10,6,8,0.85);color:#0FC1B7;opacity:0;transition:opacity 0.3s}'
    '.x86 .c:hover .o{opacity:1}')

add(87,'Card','Tilt Shine','Tilt + moving highlight',
    '<div class="x87"><div class="c"><div class="s"></div>Shine</div></div>',
    '.x87{display:flex;justify-content:center;padding:3rem}'
    '.x87 .c{position:relative;width:240px;height:160px;padding:1.3rem;background:linear-gradient(135deg,#2A354B,#0a0608);border:1px solid rgba(15,193,183,0.3);border-radius:14px;color:#fff;font-weight:800;overflow:hidden;cursor:pointer;transform:rotateY(-8deg) rotateX(5deg)}'
    '.x87 .s{position:absolute;top:-50%;left:-20%;width:40%;height:200%;background:linear-gradient(90deg,transparent,rgba(255,255,255,0.25),transparent);transform:rotate(25deg);animation:sh87 3s ease-in-out infinite}'
    '@keyframes sh87{0%,100%{left:-20%}50%{left:100%}}')

add(88,'Card','Drop Zone','Dashed upload area',
    '<div class="x88"><div class="c">&#8593; Drop files here</div></div>',
    '.x88{display:flex;justify-content:center;padding:3rem}'
    '.x88 .c{width:260px;height:140px;border:2px dashed rgba(15,193,183,0.5);border-radius:14px;display:flex;align-items:center;justify-content:center;color:rgba(15,193,183,0.8);font-size:0.95rem;cursor:pointer;transition:all 0.3s}'
    '.x88 .c:hover{background:rgba(15,193,183,0.1);border-style:solid;color:#0FC1B7}')

add(89,'Card','Price Tag','Ribbon with notch',
    '<div class="x89"><div class="c"><span class="t">$</span><span class="n">99</span></div></div>',
    '.x89{display:flex;justify-content:center;padding:3rem}'
    '.x89 .c{position:relative;padding:1rem 1.5rem;background:#0FC1B7;color:#0a0608;font-weight:900;border-radius:0 14px 14px 0;box-shadow:0 10px 30px rgba(15,193,183,0.4)}'
    '.x89 .c::before{content:"";position:absolute;left:-20px;top:0;border:20px solid transparent;border-right-color:#0FC1B7;border-top-width:29px;border-bottom-width:29px}'
    '.x89 .t{font-size:1.2rem}.x89 .n{font-size:2.4rem;margin-left:0.2rem}')

add(90,'Card','Testimonial','Quote card with avatar',
    '<div class="x90"><div class="c"><div class="q">"Truly exceptional."</div><div class="f"><div class="a">AI</div><div><div class="n">AIM Tech</div><div class="r">CEO</div></div></div></div></div>',
    '.x90{display:flex;justify-content:center;padding:3rem}'
    '.x90 .c{width:280px;padding:1.5rem;background:rgba(0,0,0,0.5);border:1px solid rgba(15,193,183,0.3);border-radius:14px}'
    '.x90 .q{color:#fff;font-style:italic;margin-bottom:1rem}'
    '.x90 .f{display:flex;gap:0.7rem;align-items:center}'
    '.x90 .a{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#0FC1B7,#2A354B);display:flex;align-items:center;justify-content:center;color:#fff;font-weight:800;font-size:0.8rem}'
    '.x90 .n{color:#fff;font-weight:700;font-size:0.85rem}'
    '.x90 .r{color:rgba(255,255,255,0.55);font-size:0.7rem}')

add(91,'Card','Stat Card','Big number + label',
    '<div class="x91"><div class="c"><div class="n">10+</div><div class="l">Years Experience</div><div class="tr">+24%</div></div></div>',
    '.x91{display:flex;justify-content:center;padding:3rem}'
    '.x91 .c{width:240px;padding:1.5rem;background:linear-gradient(135deg,rgba(15,193,183,0.15),rgba(42,53,75,0.4));border:1px solid rgba(15,193,183,0.3);border-radius:14px}'
    '.x91 .n{font-size:3rem;font-weight:900;color:#0FC1B7;letter-spacing:-2px}'
    '.x91 .l{color:rgba(255,255,255,0.6);font-size:0.8rem;letter-spacing:2px;text-transform:uppercase}'
    '.x91 .tr{color:#0FC1B7;font-size:0.8rem;margin-top:0.5rem;font-weight:700}')

# ==================== DATA VIZ (10) ====================
add(92,'Viz','Progress Ring','Circular progress',
    '<div class="x92"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/><circle cx="50" cy="50" r="40" fill="none" stroke="#0FC1B7" stroke-width="8" stroke-dasharray="251" stroke-dashoffset="75" transform="rotate(-90 50 50)"/></svg><div class="n">70%</div></div>',
    '.x92{position:relative;display:flex;justify-content:center;padding:3rem}'
    '.x92 svg{width:120px;height:120px}'
    '.x92 .n{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-size:1.4rem;font-weight:900;color:#0FC1B7}')

add(93,'Viz','Bar Chart','Animated bars grow',
    '<div class="x93"><i style="--h:40%"></i><i style="--h:70%"></i><i style="--h:50%"></i><i style="--h:85%"></i><i style="--h:60%"></i><i style="--h:95%"></i></div>',
    '.x93{display:flex;justify-content:center;align-items:flex-end;gap:10px;height:180px;padding:1rem 3rem}'
    '.x93 i{display:block;width:28px;height:var(--h);background:linear-gradient(180deg,#0FC1B7,#0A9B92);border-radius:4px 4px 0 0;animation:ba93 1.2s cubic-bezier(0.16,1,0.3,1) forwards;transform-origin:bottom;transform:scaleY(0)}'
    '.x93 i:nth-child(2){animation-delay:0.1s}.x93 i:nth-child(3){animation-delay:0.2s}.x93 i:nth-child(4){animation-delay:0.3s}.x93 i:nth-child(5){animation-delay:0.4s}.x93 i:nth-child(6){animation-delay:0.5s}'
    '@keyframes ba93{to{transform:scaleY(1)}}')

add(94,'Viz','Sparkline','Inline tiny chart',
    '<div class="x94"><svg viewBox="0 0 100 30"><polyline points="0,20 15,12 30,18 45,8 60,14 75,5 90,10 100,2" fill="none" stroke="#0FC1B7" stroke-width="2"/></svg><div class="v">+24%</div></div>',
    '.x94{display:flex;align-items:center;justify-content:center;gap:1rem;padding:3rem}'
    '.x94 svg{width:150px;height:40px}'
    '.x94 .v{color:#0FC1B7;font-weight:900;font-size:1.3rem}')

add(95,'Viz','Gauge','Semi-circle gauge',
    '<div class="x95"><svg viewBox="0 0 200 110"><path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="14"/><path d="M 20 100 A 80 80 0 0 1 160 40" fill="none" stroke="#0FC1B7" stroke-width="14" stroke-linecap="round"/></svg><div class="v">75%</div></div>',
    '.x95{position:relative;display:flex;justify-content:center;padding:3rem}'
    '.x95 svg{width:220px;height:120px}'
    '.x95 .v{position:absolute;bottom:3rem;left:50%;transform:translateX(-50%);font-size:2rem;font-weight:900;color:#0FC1B7}')

add(96,'Viz','Star Rating','5 stars filled 4',
    '<div class="x96"><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span>&#9733;</span><span class="o">&#9733;</span></div>',
    '.x96{display:flex;gap:6px;justify-content:center;padding:3rem;font-size:2rem}'
    '.x96 span{color:#0FC1B7}.x96 .o{color:rgba(255,255,255,0.2)}')

add(97,'Viz','Heat Dots','Intensity grid',
    '<div class="x97"><i style="--o:0.1"></i><i style="--o:0.3"></i><i style="--o:0.5"></i><i style="--o:0.8"></i><i style="--o:1"></i><i style="--o:0.7"></i><i style="--o:0.4"></i><i style="--o:0.2"></i><i style="--o:0.6"></i><i style="--o:0.9"></i><i style="--o:0.5"></i><i style="--o:0.3"></i></div>',
    '.x97{display:grid;grid-template-columns:repeat(6,1fr);gap:4px;max-width:200px;margin:3rem auto}'
    '.x97 i{display:block;aspect-ratio:1;background:#0FC1B7;opacity:var(--o);border-radius:3px}')

add(98,'Viz','KPI Card','Metric + delta + mini bar',
    '<div class="x98"><div class="c"><div class="l">Revenue</div><div class="v">$42K</div><div class="d">&uarr; 12% MoM</div><div class="b"><i style="width:68%"></i></div></div></div>',
    '.x98{display:flex;justify-content:center;padding:3rem}'
    '.x98 .c{width:240px;padding:1.4rem;background:linear-gradient(135deg,rgba(15,193,183,0.15),rgba(42,53,75,0.3));border-radius:14px}'
    '.x98 .l{color:rgba(255,255,255,0.6);font-size:0.75rem;letter-spacing:2px;text-transform:uppercase}'
    '.x98 .v{color:#fff;font-size:2.2rem;font-weight:900;margin:0.3rem 0 0.2rem}'
    '.x98 .d{color:#0FC1B7;font-size:0.8rem;font-weight:700}'
    '.x98 .b{margin-top:0.8rem;height:4px;background:rgba(255,255,255,0.1);border-radius:2px}'
    '.x98 .b i{display:block;height:100%;background:#0FC1B7;border-radius:2px}')

add(99,'Viz','Comparison','Double bar',
    '<div class="x99"><div class="r"><div class="a" style="width:65%"></div></div><div class="r"><div class="b" style="width:85%"></div></div></div>',
    '.x99{padding:3rem 10%;display:flex;flex-direction:column;gap:0.8rem}'
    '.x99 .r{height:24px;background:rgba(255,255,255,0.08);border-radius:12px;overflow:hidden}'
    '.x99 .a{height:100%;background:#2A354B}'
    '.x99 .b{height:100%;background:linear-gradient(90deg,#0FC1B7,#7EE8FA)}')

add(100,'Viz','Tag Cloud','Varied font sizes',
    '<div class="x100"><span>AI</span><span class="lg">Python</span><span>Rust</span><span class="md">React</span><span>Go</span><span class="lg">Cloud</span><span class="md">ML</span><span>Rust</span><span>SDK</span><span class="md">K8s</span><span>API</span></div>',
    '.x100{padding:3rem 2rem;display:flex;flex-wrap:wrap;gap:0.6rem;justify-content:center}'
    '.x100 span{padding:0.3rem 0.7rem;background:rgba(15,193,183,0.15);border:1px solid rgba(15,193,183,0.3);border-radius:20px;color:#0FC1B7;font-size:0.85rem}'
    '.x100 .md{font-size:1.1rem;padding:0.4rem 0.9rem}.x100 .lg{font-size:1.4rem;padding:0.5rem 1.1rem;background:rgba(15,193,183,0.25)}')

# ==================== INTERACTIONS (10) ====================
add(101,'UI','Toggle Switch','iOS-style toggle',
    '<div class="x101"><label class="s"><input type="checkbox" checked><span></span></label><label class="s"><input type="checkbox"><span></span></label></div>',
    '.x101{display:flex;gap:2rem;justify-content:center;padding:3rem}'
    '.x101 .s{position:relative;display:inline-block;width:52px;height:28px}'
    '.x101 input{display:none}'
    '.x101 span{position:absolute;inset:0;background:rgba(255,255,255,0.15);border-radius:14px;cursor:pointer;transition:background 0.3s}'
    '.x101 span::before{content:"";position:absolute;top:3px;left:3px;width:22px;height:22px;background:#fff;border-radius:50%;transition:transform 0.3s cubic-bezier(0.16,1,0.3,1)}'
    '.x101 input:checked+span{background:#0FC1B7}'
    '.x101 input:checked+span::before{transform:translateX(24px)}')

add(102,'UI','Like Button','Heart scale + burst',
    '<div class="x102"><button id="x102b">&#10084;<span class="c">24</span></button></div>',
    '.x102{display:flex;justify-content:center;padding:3rem}'
    '.x102 button{display:flex;align-items:center;gap:0.5rem;padding:0.6rem 1.2rem;background:rgba(255,255,255,0.08);border:1px solid rgba(255,255,255,0.15);border-radius:20px;color:rgba(255,255,255,0.7);font-size:1rem;cursor:pointer;transition:all 0.3s}'
    '.x102 button.lk{color:#ff3c78;border-color:rgba(255,60,120,0.5);background:rgba(255,60,120,0.1);transform:scale(1.05)}'
    '.x102 button:active{transform:scale(0.92)}',
    "var b=document.getElementById('x102b');if(b){var c=24;b.addEventListener('click',function(){b.classList.toggle('lk');c=b.classList.contains('lk')?25:24;b.querySelector('.c').textContent=c});}")

add(103,'UI','Radio Pills','Segment control',
    '<div class="x103"><button class="on">Day</button><button>Week</button><button>Month</button><button>Year</button></div>',
    '.x103{display:flex;justify-content:center;padding:3rem;gap:0}'
    '.x103 button{padding:0.5rem 1.2rem;background:transparent;border:1px solid rgba(15,193,183,0.4);color:#0FC1B7;cursor:pointer;font-size:0.85rem;font-family:var(--font-mono)}'
    '.x103 button:first-child{border-radius:8px 0 0 8px}.x103 button:last-child{border-radius:0 8px 8px 0}'
    '.x103 button:not(:first-child){border-left:none}'
    '.x103 .on{background:#0FC1B7;color:#0a0608;border-color:#0FC1B7}')

add(104,'UI','Number Counter','Incrementer',
    '<div class="x104"><button>-</button><span>12</span><button>+</button></div>',
    '.x104{display:flex;justify-content:center;align-items:center;gap:0.8rem;padding:3rem}'
    '.x104 button{width:36px;height:36px;border-radius:50%;border:1px solid rgba(15,193,183,0.5);background:transparent;color:#0FC1B7;cursor:pointer;font-size:1.2rem}'
    '.x104 button:hover{background:#0FC1B7;color:#0a0608}'
    '.x104 span{min-width:40px;text-align:center;font-size:1.8rem;font-weight:900;color:#fff}')

add(105,'UI','Slider Fill','Range input styled',
    '<div class="x105"><input type="range" min="0" max="100" value="65"></div>',
    '.x105{padding:3rem 2rem}'
    '.x105 input{width:100%;height:6px;background:linear-gradient(to right,#0FC1B7 0%,#0FC1B7 65%,rgba(255,255,255,0.15) 65%,rgba(255,255,255,0.15) 100%);border-radius:3px;appearance:none;outline:none}'
    '.x105 input::-webkit-slider-thumb{appearance:none;width:18px;height:18px;border-radius:50%;background:#fff;box-shadow:0 0 10px #0FC1B7;cursor:pointer}')

add(106,'UI','Checkbox Morph','Check animation',
    '<div class="x106"><label><input type="checkbox"><span></span>I agree</label><label><input type="checkbox" checked><span></span>Checked</label></div>',
    '.x106{display:flex;gap:2rem;justify-content:center;padding:3rem;color:#fff}'
    '.x106 label{display:flex;align-items:center;gap:0.5rem;cursor:pointer}'
    '.x106 input{display:none}'
    '.x106 span{width:20px;height:20px;border:2px solid rgba(15,193,183,0.5);border-radius:5px;position:relative;transition:all 0.2s}'
    '.x106 input:checked+span{background:#0FC1B7;border-color:#0FC1B7}'
    '.x106 input:checked+span::after{content:"";position:absolute;left:5px;top:1px;width:6px;height:11px;border:solid #0a0608;border-width:0 2px 2px 0;transform:rotate(45deg)}')

add(107,'UI','Pagination','Page dots',
    '<div class="x107"><button>&larr;</button><button>1</button><button class="on">2</button><button>3</button><button>4</button><button>&rarr;</button></div>',
    '.x107{display:flex;gap:0.4rem;justify-content:center;padding:3rem}'
    '.x107 button{width:38px;height:38px;border:1px solid rgba(255,255,255,0.15);background:transparent;color:#fff;border-radius:8px;cursor:pointer;font-size:0.9rem}'
    '.x107 button:hover{border-color:#0FC1B7;color:#0FC1B7}'
    '.x107 .on{background:#0FC1B7;color:#0a0608;border-color:#0FC1B7}')

add(108,'UI','Tabs Slider','Underline moves',
    '<div class="x108"><button class="on">All</button><button>Active</button><button>Archived</button><div class="u"></div></div>',
    '.x108{display:inline-flex;position:relative;padding:3rem;margin:0 auto;display:flex;justify-content:center}'
    '.x108 button{padding:0.7rem 1.4rem;background:transparent;border:none;color:rgba(255,255,255,0.6);cursor:pointer;font-size:0.9rem}'
    '.x108 .on{color:#0FC1B7}'
    '.x108 .u{position:absolute;bottom:3rem;left:calc(50% - 120px);width:50px;height:2px;background:#0FC1B7;transition:left 0.3s}')

add(109,'UI','Chip Filter','Removable tags',
    '<div class="x109"><span>React<b>&times;</b></span><span>Cloud<b>&times;</b></span><span>AI<b>&times;</b></span><span class="add">+ Add</span></div>',
    '.x109{display:flex;gap:0.5rem;justify-content:center;padding:3rem;flex-wrap:wrap}'
    '.x109 span{display:inline-flex;align-items:center;gap:0.4rem;padding:0.35rem 0.8rem;background:rgba(15,193,183,0.15);border:1px solid rgba(15,193,183,0.35);border-radius:20px;color:#0FC1B7;font-size:0.82rem}'
    '.x109 b{cursor:pointer;font-weight:400;opacity:0.6}.x109 b:hover{opacity:1;color:#ff3c78}'
    '.x109 .add{background:transparent;border-style:dashed;cursor:pointer}')

add(110,'UI','Toast','Slide-in notification',
    '<div class="x110"><div class="t">&#10003; Saved successfully</div></div>',
    '.x110{display:flex;justify-content:center;padding:3rem}'
    '.x110 .t{padding:0.8rem 1.4rem;background:#0FC1B7;color:#0a0608;border-radius:8px;font-weight:700;box-shadow:0 15px 40px rgba(15,193,183,0.4);animation:ts110 2s ease-in-out infinite}'
    '@keyframes ts110{0%,100%{transform:translateX(0);opacity:1}40%,60%{transform:translateX(0);opacity:1}80%,99%{transform:translateX(20px);opacity:0}}')

# ==================== NAVIGATION (10) ====================
add(111,'Nav','Breadcrumb','Path trail',
    '<div class="x111"><a>Home</a><span>&rsaquo;</span><a>Blog</a><span>&rsaquo;</span><span class="c">Article</span></div>',
    '.x111{display:flex;gap:0.5rem;justify-content:center;padding:3rem;align-items:center;font-size:0.85rem}'
    '.x111 a{color:rgba(255,255,255,0.6);cursor:pointer}.x111 a:hover{color:#0FC1B7}'
    '.x111 span{color:rgba(255,255,255,0.3)}.x111 .c{color:#0FC1B7;font-weight:700}')

add(112,'Nav','Back-to-Top','Floating arrow button',
    '<div class="x112"><button>&uarr;</button></div>',
    '.x112{display:flex;justify-content:flex-end;padding:3rem}'
    '.x112 button{width:48px;height:48px;border-radius:50%;background:#0FC1B7;color:#0a0608;border:none;font-size:1.3rem;cursor:pointer;box-shadow:0 8px 25px rgba(15,193,183,0.5);animation:bk112 2s ease-in-out infinite}'
    '@keyframes bk112{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}')

add(113,'Nav','Dropdown','Hover menu',
    '<div class="x113"><div class="d"><button>Menu &dtrif;</button><ul><li>Item 1</li><li>Item 2</li><li>Item 3</li></ul></div></div>',
    '.x113{display:flex;justify-content:center;padding:3rem}'
    '.x113 .d{position:relative}'
    '.x113 button{padding:0.7rem 1.2rem;background:rgba(15,193,183,0.1);border:1px solid rgba(15,193,183,0.4);color:#0FC1B7;border-radius:8px;cursor:pointer}'
    '.x113 ul{position:absolute;top:calc(100% + 8px);left:0;list-style:none;padding:0.4rem 0;min-width:150px;background:#0a0608;border:1px solid rgba(15,193,183,0.3);border-radius:8px;opacity:0;pointer-events:none;transform:translateY(-4px);transition:all 0.25s}'
    '.x113 .d:hover ul{opacity:1;pointer-events:auto;transform:translateY(0)}'
    '.x113 li{padding:0.5rem 1rem;color:#fff;font-size:0.85rem;cursor:pointer}'
    '.x113 li:hover{background:rgba(15,193,183,0.1);color:#0FC1B7}')

add(114,'Nav','Badge','Number notification',
    '<div class="x114"><button>&#128276;<span>3</span></button><button>Messages<span>12</span></button></div>',
    '.x114{display:flex;gap:2rem;justify-content:center;padding:3rem}'
    '.x114 button{position:relative;padding:0.7rem 1.2rem;background:transparent;border:1px solid rgba(255,255,255,0.15);color:#fff;border-radius:8px;cursor:pointer}'
    '.x114 span{position:absolute;top:-6px;right:-6px;background:#ff3c78;color:#fff;min-width:20px;height:20px;border-radius:10px;font-size:0.7rem;font-weight:700;display:flex;align-items:center;justify-content:center;padding:0 6px}')

add(115,'Nav','Chip Tabs','Pill-shaped tabs',
    '<div class="x115"><button class="on">Feed</button><button>Explore</button><button>Saved</button></div>',
    '.x115{display:flex;gap:0.5rem;justify-content:center;padding:3rem}'
    '.x115 button{padding:0.5rem 1.2rem;background:rgba(255,255,255,0.06);border:none;color:rgba(255,255,255,0.6);border-radius:20px;cursor:pointer}'
    '.x115 .on{background:#0FC1B7;color:#0a0608;font-weight:700}')

add(116,'Nav','Segment','Connected buttons',
    '<div class="x116"><button class="on">List</button><button>Grid</button></div>',
    '.x116{display:flex;justify-content:center;padding:3rem}'
    '.x116 button{padding:0.6rem 1.5rem;border:1px solid #0FC1B7;background:transparent;color:#0FC1B7;cursor:pointer}'
    '.x116 button:first-child{border-radius:8px 0 0 8px}'
    '.x116 button:last-child{border-radius:0 8px 8px 0;border-left:none}'
    '.x116 .on{background:#0FC1B7;color:#0a0608}')

add(117,'Nav','Avatar Stack','Overlapping circles',
    '<div class="x117"><i>AI</i><i>MT</i><i>BH</i><i>CA</i><span>+12</span></div>',
    '.x117{display:flex;justify-content:center;align-items:center;padding:3rem}'
    '.x117 i{display:flex;align-items:center;justify-content:center;width:40px;height:40px;border-radius:50%;background:linear-gradient(135deg,#0FC1B7,#2A354B);color:#fff;font-style:normal;font-weight:700;font-size:0.75rem;border:2px solid #0a0608;margin-left:-12px}'
    '.x117 i:first-child{margin-left:0}'
    '.x117 span{margin-left:0.5rem;color:rgba(255,255,255,0.6);font-size:0.85rem}')

add(118,'Nav','Search Bar','Input with icon',
    '<div class="x118"><div class="w"><span>&#128269;</span><input placeholder="Search..."></div></div>',
    '.x118{display:flex;justify-content:center;padding:3rem}'
    '.x118 .w{position:relative;width:300px}'
    '.x118 span{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:rgba(255,255,255,0.4)}'
    '.x118 input{width:100%;padding:0.8rem 1rem 0.8rem 2.4rem;background:rgba(255,255,255,0.05);border:1px solid rgba(255,255,255,0.15);border-radius:10px;color:#fff;outline:none}'
    '.x118 input:focus{border-color:#0FC1B7;background:rgba(15,193,183,0.05)}')

add(119,'Nav','Bottom Nav','Mobile tab bar',
    '<div class="x119"><i>&#127968;<s>Home</s></i><i class="on">&#9733;<s>Star</s></i><i>&#128269;<s>Search</s></i><i>&#128100;<s>Profile</s></i></div>',
    '.x119{display:flex;justify-content:space-around;padding:1rem 2rem;background:rgba(10,6,8,0.8);border:1px solid rgba(255,255,255,0.08);border-radius:18px;margin:3rem auto;max-width:360px;backdrop-filter:blur(10px)}'
    '.x119 i{display:flex;flex-direction:column;align-items:center;gap:0.25rem;color:rgba(255,255,255,0.5);font-size:1.1rem;cursor:pointer;font-style:normal}'
    '.x119 s{font-size:0.62rem;text-decoration:none;letter-spacing:1px}'
    '.x119 .on{color:#0FC1B7}')

add(120,'Nav','Scroll Progress','Horizontal bar',
    '<div class="x120"><div class="b"><div class="f"></div></div></div>',
    '.x120{padding:3rem 2rem}'
    '.x120 .b{height:3px;background:rgba(255,255,255,0.1);border-radius:2px;overflow:hidden}'
    '.x120 .f{width:64%;height:100%;background:linear-gradient(90deg,#0FC1B7,#7EE8FA);animation:pg120 2.5s ease-in-out infinite}'
    '@keyframes pg120{0%{width:0}100%{width:64%}}')

# ==================== MISC (10) ====================
add(121,'Misc','Confetti','Burst particles',
    '<div class="x121"><button>Celebrate!</button><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
    '.x121{position:relative;display:flex;justify-content:center;padding:3rem}'
    '.x121 button{padding:0.8rem 1.5rem;background:#0FC1B7;color:#0a0608;border:none;border-radius:8px;font-weight:700;cursor:pointer}'
    '.x121 i{position:absolute;width:8px;height:8px;top:50%;left:50%;border-radius:2px;animation:cf121 1.5s ease-out infinite}'
    '.x121 i:nth-child(2){--x:60px;--y:-80px;background:#0FC1B7}'
    '.x121 i:nth-child(3){--x:-80px;--y:-40px;background:#ff3c78;animation-delay:0.1s}'
    '.x121 i:nth-child(4){--x:40px;--y:-100px;background:#ffb347;animation-delay:0.2s}'
    '.x121 i:nth-child(5){--x:-50px;--y:-90px;background:#7EE8FA;animation-delay:0.15s}'
    '.x121 i:nth-child(6){--x:90px;--y:-50px;background:#a14eff;animation-delay:0.25s}'
    '.x121 i:nth-child(7){--x:-100px;--y:-60px;background:#0FC1B7;animation-delay:0.3s}'
    '.x121 i:nth-child(8){--x:70px;--y:-110px;background:#ffe066;animation-delay:0.35s}'
    '.x121 i:nth-child(9){--x:-30px;--y:-120px;background:#ff3c78;animation-delay:0.4s}'
    '@keyframes cf121{0%{transform:translate(-50%,-50%) scale(0);opacity:1}100%{transform:translate(calc(-50% + var(--x)),calc(-50% + var(--y))) rotate(720deg) scale(1);opacity:0}}')

add(122,'Misc','Coin Flip','3D coin rotation',
    '<div class="x122"><div class="c"><div class="f">$</div><div class="b">&euro;</div></div></div>',
    '.x122{display:flex;justify-content:center;padding:3rem;perspective:1000px}'
    '.x122 .c{width:80px;height:80px;position:relative;transform-style:preserve-3d;animation:cn122 2s linear infinite}'
    '.x122 .f,.x122 .b{position:absolute;inset:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:2rem;font-weight:900;backface-visibility:hidden}'
    '.x122 .f{background:linear-gradient(135deg,#ffe066,#d4af37);color:#0a0608}'
    '.x122 .b{background:linear-gradient(135deg,#d4af37,#8b6914);color:#0a0608;transform:rotateY(180deg)}'
    '@keyframes cn122{to{transform:rotateY(360deg)}}')

add(123,'Misc','Battery','Charge level animated',
    '<div class="x123"><div class="b"><div class="c"></div><div class="t"></div></div><div class="p">85%</div></div>',
    '.x123{display:flex;flex-direction:column;align-items:center;gap:0.5rem;padding:3rem}'
    '.x123 .b{display:flex;width:80px;height:36px;border:2px solid #0FC1B7;border-radius:4px;padding:2px;position:relative}'
    '.x123 .c{width:85%;background:linear-gradient(90deg,#0FC1B7,#7EE8FA);border-radius:2px;animation:bt123 3s ease-in-out infinite}'
    '.x123 .t{position:absolute;right:-6px;top:8px;width:4px;height:16px;background:#0FC1B7;border-radius:0 2px 2px 0}'
    '.x123 .p{color:#0FC1B7;font-weight:700}'
    '@keyframes bt123{0%,100%{opacity:1}50%{opacity:0.6}}')

add(124,'Misc','Clock','Analog ticking',
    '<div class="x124"><div class="c"><div class="h h1"></div><div class="h h2"></div><div class="h h3"></div></div></div>',
    '.x124{display:flex;justify-content:center;padding:3rem}'
    '.x124 .c{position:relative;width:100px;height:100px;border:2px solid #0FC1B7;border-radius:50%}'
    '.x124 .h{position:absolute;top:50%;left:50%;background:#0FC1B7;transform-origin:bottom center}'
    '.x124 .h1{width:2px;height:30px;margin-left:-1px;margin-top:-30px;animation:ck124a 60s linear infinite}'
    '.x124 .h2{width:3px;height:34px;margin-left:-1.5px;margin-top:-34px;animation:ck124a 3600s linear infinite}'
    '.x124 .h3{width:1px;height:40px;margin-left:-0.5px;margin-top:-40px;background:#ff3c78;animation:ck124a 1s linear infinite}'
    '@keyframes ck124a{to{transform:rotate(360deg)}}')

add(125,'Misc','Audio Wave','Equalizer animation',
    '<div class="x125"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
    '.x125{display:flex;justify-content:center;align-items:center;gap:3px;padding:3rem;height:100px}'
    '.x125 i{display:block;width:4px;background:#0FC1B7;border-radius:2px;animation:aw125 1s ease-in-out infinite}'
    '.x125 i:nth-child(1){animation-delay:0s}.x125 i:nth-child(2){animation-delay:0.1s}.x125 i:nth-child(3){animation-delay:0.2s}.x125 i:nth-child(4){animation-delay:0.3s}.x125 i:nth-child(5){animation-delay:0.4s}'
    '.x125 i:nth-child(6){animation-delay:0.5s}.x125 i:nth-child(7){animation-delay:0.4s}.x125 i:nth-child(8){animation-delay:0.3s}.x125 i:nth-child(9){animation-delay:0.2s}.x125 i:nth-child(10){animation-delay:0.1s}'
    '@keyframes aw125{0%,100%{height:10px}50%{height:60px}}')

add(126,'Misc','Weather Card','Sun + clouds',
    '<div class="x126"><div class="c"><div class="s"></div><div class="cl"></div><div class="t">72&deg;F</div><div class="l">Sunny</div></div></div>',
    '.x126{display:flex;justify-content:center;padding:3rem}'
    '.x126 .c{position:relative;width:220px;padding:2rem;background:linear-gradient(135deg,#0FC1B7,#7EE8FA);border-radius:20px;color:#0a0608;overflow:hidden}'
    '.x126 .s{position:absolute;top:15px;right:20px;width:60px;height:60px;background:radial-gradient(circle,#ffe066,#ffb347);border-radius:50%;box-shadow:0 0 30px rgba(255,224,102,0.8)}'
    '.x126 .cl{position:absolute;top:60px;right:5px;width:80px;height:20px;background:rgba(255,255,255,0.7);border-radius:20px;filter:blur(3px)}'
    '.x126 .t{font-size:3rem;font-weight:900;margin-top:1rem;position:relative}'
    '.x126 .l{font-weight:700;position:relative}')

add(127,'Misc','Music Player','Mini controls',
    '<div class="x127"><div class="c"><div class="a"></div><div><div class="t">Focus Flow</div><div class="r">Lo-fi Beats</div></div><button>&#9658;</button></div></div>',
    '.x127{display:flex;justify-content:center;padding:3rem}'
    '.x127 .c{display:flex;align-items:center;gap:0.8rem;padding:0.7rem 1rem 0.7rem 0.7rem;background:rgba(10,6,8,0.8);border:1px solid rgba(15,193,183,0.3);border-radius:14px;width:260px}'
    '.x127 .a{width:44px;height:44px;border-radius:8px;background:linear-gradient(135deg,#0FC1B7,#2A354B);flex-shrink:0}'
    '.x127 .t{color:#fff;font-weight:700;font-size:0.85rem}'
    '.x127 .r{color:rgba(255,255,255,0.55);font-size:0.72rem}'
    '.x127 button{margin-left:auto;width:36px;height:36px;border-radius:50%;border:none;background:#0FC1B7;color:#0a0608;cursor:pointer}')

add(128,'Misc','Timer','Countdown circle',
    '<div class="x128"><svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="45" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="6"/><circle cx="50" cy="50" r="45" fill="none" stroke="#0FC1B7" stroke-width="6" stroke-dasharray="283" stroke-linecap="round" transform="rotate(-90 50 50)"/></svg><div class="n">00:25</div></div>',
    '.x128{position:relative;display:flex;justify-content:center;padding:3rem}'
    '.x128 svg{width:140px;height:140px}'
    '.x128 svg circle:last-child{animation:tm128 25s linear infinite}'
    '.x128 .n{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:var(--font-mono);font-size:1.6rem;font-weight:900;color:#0FC1B7}'
    '@keyframes tm128{from{stroke-dashoffset:0}to{stroke-dashoffset:283}}')

add(129,'Misc','Calendar Day','Single day cell',
    '<div class="x129"><div class="c"><div class="m">APR</div><div class="d">18</div><div class="y">2026</div></div></div>',
    '.x129{display:flex;justify-content:center;padding:3rem}'
    '.x129 .c{width:110px;background:#fff;border-radius:12px;overflow:hidden;text-align:center;box-shadow:0 15px 40px rgba(0,0,0,0.4)}'
    '.x129 .m{padding:0.5rem;background:#ff3c78;color:#fff;font-weight:900;letter-spacing:3px;font-size:0.8rem}'
    '.x129 .d{padding:0.8rem 0;font-size:2.8rem;font-weight:900;color:#0a0608}'
    '.x129 .y{padding-bottom:0.5rem;color:rgba(0,0,0,0.5);font-size:0.75rem;letter-spacing:2px}')

add(130,'Misc','Tooltip','Hover label',
    '<div class="x130"><span>Hover me<b>Tooltip text here</b></span></div>',
    '.x130{display:flex;justify-content:center;padding:3rem}'
    '.x130 span{position:relative;padding:0.7rem 1.2rem;background:rgba(15,193,183,0.15);border:1px solid rgba(15,193,183,0.4);border-radius:8px;color:#0FC1B7;cursor:help}'
    '.x130 b{position:absolute;bottom:calc(100% + 10px);left:50%;transform:translateX(-50%);padding:0.5rem 0.8rem;background:#0a0608;color:#fff;border:1px solid rgba(15,193,183,0.3);border-radius:6px;font-size:0.78rem;white-space:nowrap;opacity:0;pointer-events:none;transition:all 0.25s;font-weight:400}'
    '.x130 b::after{content:"";position:absolute;top:100%;left:50%;transform:translateX(-50%);border:5px solid transparent;border-top-color:#0a0608}'
    '.x130 span:hover b{opacity:1;transform:translateX(-50%) translateY(-4px)}')

add(131,'Misc','QR Dots','Stylized QR-like grid',
    '<div class="x131"></div>',
    '.x131{width:140px;height:140px;margin:3rem auto;background:#fff;padding:10px;border-radius:8px}'
    '.x131{background-image:conic-gradient(#000 25%,transparent 25% 50%,#000 50% 75%,transparent 75%);background-size:10px 10px;background-position:0 0}')

add(132,'Misc','Envelope','Email icon',
    '<div class="x132"><div class="e"><div class="f"></div></div></div>',
    '.x132{display:flex;justify-content:center;padding:3rem}'
    '.x132 .e{position:relative;width:80px;height:60px;background:#0FC1B7;border-radius:6px;overflow:hidden}'
    '.x132 .f{position:absolute;inset:0;background:linear-gradient(135deg,transparent 46%,#0A9B92 46% 54%,transparent 54%),linear-gradient(-135deg,transparent 46%,#0A9B92 46% 54%,transparent 54%)}')

add(133,'Misc','Location Pin','Map pin shape',
    '<div class="x133"><div class="p"></div></div>',
    '.x133{display:flex;justify-content:center;padding:3rem}'
    '.x133 .p{position:relative;width:40px;height:40px;background:#ff3c78;border-radius:50% 50% 50% 0;transform:rotate(-45deg);box-shadow:0 10px 20px rgba(255,60,120,0.4);animation:pn133 1.5s ease-in-out infinite}'
    '.x133 .p::before{content:"";position:absolute;top:10px;left:10px;width:20px;height:20px;background:#fff;border-radius:50%}'
    '@keyframes pn133{0%,100%{transform:rotate(-45deg) translateY(0)}50%{transform:rotate(-45deg) translateY(-8px)}}')

add(134,'Misc','Pulse Dot','Status indicator',
    '<div class="x134"><span><i></i>Online</span><span class="off"><i></i>Offline</span><span class="away"><i></i>Away</span></div>',
    '.x134{display:flex;gap:2rem;justify-content:center;padding:3rem;color:#fff}'
    '.x134 span{display:inline-flex;align-items:center;gap:0.5rem;font-size:0.9rem}'
    '.x134 i{display:block;width:10px;height:10px;border-radius:50%;background:#0FC1B7;box-shadow:0 0 0 3px rgba(15,193,183,0.3);animation:pl134 1.5s ease-in-out infinite}'
    '.x134 .off i{background:#666;box-shadow:0 0 0 3px rgba(102,102,102,0.3);animation:none}'
    '.x134 .away i{background:#ffb347;box-shadow:0 0 0 3px rgba(255,179,71,0.3)}'
    '@keyframes pl134{0%,100%{box-shadow:0 0 0 0 rgba(15,193,183,0.8)}50%{box-shadow:0 0 0 8px rgba(15,193,183,0)}}')

add(135,'Misc','QR-Style Loader','Block-scan loader',
    '<div class="x135"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
    '.x135{display:grid;grid-template-columns:repeat(3,1fr);gap:4px;width:60px;margin:3rem auto}'
    '.x135 i{display:block;aspect-ratio:1;background:#0FC1B7;animation:qr135 1.8s ease-in-out infinite}'
    '.x135 i:nth-child(1){animation-delay:0s}.x135 i:nth-child(2){animation-delay:0.1s}.x135 i:nth-child(3){animation-delay:0.2s}'
    '.x135 i:nth-child(4){animation-delay:0.3s}.x135 i:nth-child(5){animation-delay:0.4s}.x135 i:nth-child(6){animation-delay:0.5s}'
    '.x135 i:nth-child(7){animation-delay:0.6s}.x135 i:nth-child(8){animation-delay:0.7s}.x135 i:nth-child(9){animation-delay:0.8s}'
    '@keyframes qr135{0%,100%{opacity:0.2}50%{opacity:1}}')

add(136,'Misc','Hamburger Morph','Animated icon',
    '<div class="x136"><div class="h"><s></s><s></s><s></s></div></div>',
    '.x136{display:flex;justify-content:center;padding:3rem}'
    '.x136 .h{width:40px;height:30px;position:relative;cursor:pointer;animation:hm136 3s ease-in-out infinite}'
    '.x136 s{display:block;width:100%;height:3px;background:#0FC1B7;border-radius:2px;position:absolute;transition:all 0.3s}'
    '.x136 s:nth-child(1){top:0}.x136 s:nth-child(2){top:50%;margin-top:-1.5px}.x136 s:nth-child(3){bottom:0}'
    '@keyframes hm136{50%{transform:rotate(180deg)}}')

add(137,'Misc','Emoji Bounce','Emoji pogo',
    '<div class="x137"><span>&#128640;</span><span>&#128293;</span><span>&#11088;</span></div>',
    '.x137{display:flex;gap:2rem;justify-content:center;padding:3rem;font-size:3rem}'
    '.x137 span{animation:bc137 1s ease-in-out infinite}'
    '.x137 span:nth-child(2){animation-delay:0.2s}.x137 span:nth-child(3){animation-delay:0.4s}'
    '@keyframes bc137{0%,100%{transform:translateY(0)}50%{transform:translateY(-20px)}}')

add(138,'Misc','Page Fold','Corner fold peel',
    '<div class="x138"><div class="p">Document<span class="f"></span></div></div>',
    '.x138{display:flex;justify-content:center;padding:3rem}'
    '.x138 .p{position:relative;width:200px;height:140px;background:#fff;color:#0a0608;padding:1rem;font-weight:700;border-radius:4px;box-shadow:0 10px 30px rgba(0,0,0,0.3)}'
    '.x138 .f{position:absolute;top:0;right:0;width:30px;height:30px;background:linear-gradient(225deg,#0a0608 50%,#ccc 50%);border-bottom-left-radius:4px}')

add(139,'Misc','Ticket','Dashed torn edge',
    '<div class="x139"><div class="t"><div class="l">BOARDING PASS</div><div class="n">AIM 2026</div></div></div>',
    '.x139{display:flex;justify-content:center;padding:3rem}'
    '.x139 .t{position:relative;padding:1.5rem 2rem;background:#0FC1B7;color:#0a0608;border-radius:10px;font-weight:700}'
    '.x139 .t::before,.x139 .t::after{content:"";position:absolute;left:0;right:0;height:10px;background:repeating-linear-gradient(90deg,#0FC1B7 0 8px,transparent 8px 16px)}'
    '.x139 .t::before{top:0}.x139 .t::after{bottom:0}'
    '.x139 .l{font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;color:rgba(10,6,8,0.7)}'
    '.x139 .n{font-size:1.4rem;margin-top:0.4rem}')

add(140,'Misc','Credit Card','Faux card design',
    '<div class="x140"><div class="c"><div class="l">AIM TECH AI</div><div class="n">4242 ****  **** 2026</div><div class="f"><span>VALID<br><b>04/30</b></span><span class="b">VISA</span></div></div></div>',
    '.x140{display:flex;justify-content:center;padding:3rem}'
    '.x140 .c{width:280px;padding:1.5rem;background:linear-gradient(135deg,#0FC1B7,#2A354B);border-radius:14px;color:#fff;box-shadow:0 20px 50px rgba(0,0,0,0.4)}'
    '.x140 .l{font-family:var(--font-mono);font-size:0.65rem;letter-spacing:3px;color:rgba(255,255,255,0.7)}'
    '.x140 .n{font-family:var(--font-mono);font-size:1.2rem;letter-spacing:2px;margin:2rem 0 1rem}'
    '.x140 .f{display:flex;justify-content:space-between;align-items:flex-end;font-family:var(--font-mono);font-size:0.65rem;letter-spacing:2px;color:rgba(255,255,255,0.7)}'
    '.x140 .b{font-size:1.2rem;font-weight:900;color:#fff;font-family:var(--font-display);letter-spacing:0}')

add(141,'Misc','Snow Globe','Dots falling',
    '<div class="x141"><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i><i></i></div>',
    '.x141{position:relative;height:200px;border-radius:50% 50% 50% 50% / 60% 60% 40% 40%;background:radial-gradient(circle at 50% 30%,#7EE8FA,#2A354B);overflow:hidden;margin:3rem auto;width:180px}'
    '.x141 i{position:absolute;width:4px;height:4px;background:#fff;border-radius:50%;animation:sn141 4s linear infinite}'
    '.x141 i:nth-child(1){left:10%;animation-delay:0s}.x141 i:nth-child(2){left:30%;animation-delay:0.5s}.x141 i:nth-child(3){left:50%;animation-delay:1s}'
    '.x141 i:nth-child(4){left:70%;animation-delay:1.5s}.x141 i:nth-child(5){left:90%;animation-delay:2s}'
    '.x141 i:nth-child(6){left:20%;animation-delay:2.5s}.x141 i:nth-child(7){left:40%;animation-delay:0.8s}.x141 i:nth-child(8){left:60%;animation-delay:1.3s}'
    '.x141 i:nth-child(9){left:80%;animation-delay:1.8s}.x141 i:nth-child(10){left:15%;animation-delay:2.3s}'
    '@keyframes sn141{from{transform:translateY(-10px)}to{transform:translateY(210px)}}')

TEMPLATE = '''<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Studio Lab +100 | AIM Tech AI</title>
  <meta name="robots" content="noindex, nofollow">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800;900&family=Space+Mono:wght@400;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/styles.css">
<script>/* theme-init */const t=localStorage.getItem("theme");if(t)document.documentElement.setAttribute("data-theme",t);</script>
<style>
  .demo-grid {{
    max-width: 1400px; margin: 0 auto; padding: 6rem 2rem 4rem;
    display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.2rem;
  }}
  .demo-box {{
    background: rgba(0,0,0,0.4); border: 1px solid rgba(15,193,183,0.15);
    border-radius: 14px; overflow: hidden; position: relative;
    min-height: 280px; display: flex; flex-direction: column;
  }}
  .demo-box-head {{
    padding: 0.7rem 1rem 0.3rem;
    display: flex; gap: 0.5rem; align-items: center;
    font-family: var(--font-mono); font-size: 0.62rem; letter-spacing: 2px;
    text-transform: uppercase; color: rgba(15,193,183,0.8);
    border-bottom: 1px solid rgba(15,193,183,0.12);
  }}
  .demo-num {{
    padding: 0.15rem 0.4rem; background: rgba(15,193,183,0.2);
    border-radius: 3px; color: #0FC1B7;
  }}
  .demo-cat {{ opacity: 0.5; }}
  .demo-title {{ color: #fff; font-weight: 700; letter-spacing: 1px; font-size: 0.72rem; }}
  .demo-body {{ flex: 1; display: flex; align-items: center; justify-content: center; padding: 0; }}
  .demo-desc {{
    padding: 0.5rem 1rem 0.8rem;
    color: rgba(255,255,255,0.55); font-size: 0.72rem;
    border-top: 1px solid rgba(255,255,255,0.05);
  }}
  .lab-hero {{
    max-width: 900px; margin: 0 auto; padding: 9rem 2rem 1rem; text-align: center;
  }}
  .lab-hero .section-title {{ margin: 0; }}
  .lab-hero p {{ color: var(--clr-text-dim); margin-top: 1rem; max-width: 600px; margin-left: auto; margin-right: auto; }}
{extra_css}
</style>
</head>
<body>
  <div class="noise-overlay"></div>

  <nav id="navbar">
    <a href="/" class="nav-logo"><img class="logo-dark" src="/assets/aim_transparent_logo.png" alt="AIM Tech AI" style="height:38px;width:auto;display:block;"><img class="logo-light" src="/assets/black_aim_transparent_logo.png" alt="AIM Tech AI" style="height:38px;width:auto;display:none;"></a>
    <ul class="nav-links" id="nav-links">
      <li><a href="/studiolab" data-scramble>Studio Lab</a></li>
      <li><a href="/about" data-scramble>About</a></li>
      <li><a href="/blog" data-scramble>Blog</a></li>
      <li><a href="/#contact" data-scramble>Contact</a></li>
    </ul>
    <div class="nav-actions">
      <button class="theme-toggle" id="theme-toggle" aria-label="Toggle light/dark mode">
        <span class="theme-toggle-icon" id="theme-icon">&#127769;</span>
      </button>
      <a href="/book" class="nav-cta gradient-btn" style="--gfrom:#0FC1B7;--gto:#0A9B92;" aria-label="Book a Call"><span class="gbtn-glow"></span><span class="gbtn-bg"></span><span class="gbtn-icon">&#128197;</span><span class="gbtn-label">Book a Call</span></a>
    </div>
  </nav>

  <div class="content">
    <div class="lab-hero">
      <div class="lab-label" style="font-family:var(--font-mono);font-size:0.7rem;letter-spacing:3px;text-transform:uppercase;color:var(--clr-primary);margin-bottom:0.6rem;">// Studio Lab · Part 2</div>
      <h1 class="section-title">+100 Compact Experiments</h1>
      <p>Text effects, buttons, loaders, backgrounds, cards, data viz, interactions, navigation, and misc delights. <a href="/studiolab" style="color:var(--clr-primary);">← Back to Studio Lab</a></p>
    </div>

    <div class="demo-grid">
{items}
    </div>

  </div>

  <footer id="footer" style="padding-top:4rem;">
    <div style="max-width:1200px;margin:0 auto;padding:0 2rem;text-align:center;color:var(--clr-text-dim);font-size:0.85rem;">
      <p>&copy; 2026 AIM Tech AI LLC. Beverly Hills, California.</p>
    </div>
  </footer>

  <script type="module">
    import {{ initUI }} from '/js/ui.js';
    import {{ initRouter }} from '/js/router.js';
    initUI();
    initRouter();
  </script>
  <script>
{extra_js}
  </script>
</body>
</html>
'''

def main():
    items = []
    extra_css_parts = []
    extra_js_parts = []
    for num, cat, title, desc, html, css, js in E:
        items.append(f'''      <div class="demo-box">
        <div class="demo-box-head"><span class="demo-num">{num:03d}</span><span class="demo-cat">{cat}</span><span class="demo-title">{title}</span></div>
        <div class="demo-body">{html}</div>
        <div class="demo-desc">{desc}</div>
      </div>''')
        extra_css_parts.append(css)
        if js:
            extra_js_parts.append(js)
    OUT.write_text(TEMPLATE.format(
        items='\n'.join(items),
        extra_css='\n'.join(extra_css_parts),
        extra_js='\n'.join(extra_js_parts),
    ), encoding='utf-8')
    print(f'wrote {OUT} with {len(E)} experiments')

if __name__ == '__main__':
    main()
