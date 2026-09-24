from pathlib import Path
p=Path('tmp/block-drawing/build.py');s=p.read_text()
a="M 444,96 C 425,91 406,95 391,108"
b="M 444,137 C 439,128 432,124 424,125 C 411,125 401,136 394,149 C 386,164 382,184 374,195 C 370,200 369,206 374,211 C 378,217 385,217 390,213 C 400,203 405,183 412,166 C 417,153 422,147 429,146 C 434,145 439,149 443,153 C 444,148 445,142 444,137 Z"
start=s.index("add('hair_front_right',");end=s.index("\nadd('hair_front_left'",start);s=s[:start]+"add('hair_front_right','"+b+"')"+s[end:]
b="M 444,137 C 449,129 456,125 465,126 C 478,127 488,137 495,151 C 503,167 507,187 514,198 C 518,204 516,210 511,213 C 506,216 500,216 495,212 C 486,202 481,184 475,166 C 470,153 465,147 458,146 C 453,145 448,149 444,153 C 443,148 443,142 444,137 Z"
start=s.index("add('hair_front_left',");end=s.index('\n# 脸旁',start);s=s[:start]+"add('hair_front_left','"+b+"')"+s[end:]
b="M 411,158 C 405,177 401,195 391,213 C 382,229 369,245 363,263 C 358,274 360,282 362,288 C 356,282 357,269 362,256 C 368,239 379,224 387,208 C 395,191 399,172 403,164 Z M 405,202 C 405,225 400,245 395,265 C 391,282 394,292 395,304 C 397,317 391,331 385,344 C 378,357 375,367 378,380 C 378,393 370,403 359,409 C 367,400 373,391 371,379 C 368,363 375,345 381,331 C 389,315 391,306 388,292 C 384,278 386,260 389,244 C 392,226 394,214 398,201 Z M 389,285 C 391,298 390,307 386,315 C 383,310 383,304 385,296 Z"
start=s.index("add('hair_side_right',");end=s.index("\nadd('hair_side_left'",start);s=s[:start]+"add('hair_side_right','"+b+"')"+s[end:]
b="M 477,158 C 483,177 487,195 497,213 C 506,229 519,245 525,263 C 530,275 528,283 526,289 C 532,282 531,269 526,256 C 520,239 509,224 501,208 C 493,191 489,172 485,164 Z M 483,202 C 483,225 488,245 493,265 C 497,282 494,292 493,304 C 491,317 497,331 503,344 C 510,357 513,367 510,380 C 510,393 518,403 529,409 C 521,400 515,391 517,379 C 520,363 513,345 507,331 C 499,315 497,306 500,292 C 504,278 502,260 499,244 C 496,226 494,214 490,201 Z M 499,285 C 497,298 498,307 502,315 C 505,310 505,304 503,296 Z"
start=s.index("add('hair_side_left',");end=s.index('\n# 手形',start);s=s[:start]+"add('hair_side_left','"+b+"')"+s[end:]
s=s.replace("'M 442,219 C 441,224 439,227 440,230 C 442,232 445,232 448,229 C 445,229 444,228 444,226 L 444,219 Z'","'M 441,225 C 440,227 440,230 443,231 C 445,231 447,230 448,228 C 445,230 443,229 443,226 Z'")
s=s.replace(' Z M 444,61 L 435,77 L 443,87 L 452,77 Z',' Z')
# Make narrow leg overlap stay inside actual outer knee.
s=s.replace('C 512,1078 517,1091 518,1106 C 507,1119 475,1126 455,1114','C 512,1078 513,1087 514,1097 C 504,1110 475,1117 455,1107')
# Reorder without modifying geometry: streamers behind arms; torso below thighs.
needle='seen=set(ids); assert seen==set(parts),(set(parts)-seen,seen-set(parts))'
new="""# 足链后半环作为同一部件跨层，位于腿脚后。
add('foot_chain_right','M 392,1471 C 401,1458 430,1458 441,1471 L 440,1473 C 428,1462 404,1462 393,1473 Z',sub='踝后隐藏弧')
add('foot_chain_left','M 447,1473 C 458,1460 485,1460 498,1471 L 498,1473 C 484,1463 460,1464 449,1475 Z',sub='踝后隐藏弧')
def move_before(gid,target):
 idx=next(i for i,g in enumerate(G) if g.startswith('<g id="'+gid+'"'))
 val=G.pop(idx); dst=next(i for i,g in enumerate(G) if g.startswith('<g id="'+target+'"'));G.insert(dst,val)
move_before('streamer_right','pelvis');move_before('streamer_left','pelvis')
move_before('torso','thigh_right')
move_before('foot_chain_right_2','thigh_right');move_before('foot_chain_left_2','thigh_right')
seen=set(ids); assert seen==set(parts),(set(parts)-seen,seen-set(parts))"""
s=s.replace(needle,new)
p.write_text(s)
