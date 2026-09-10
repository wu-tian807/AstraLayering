"""A complete head underneath the bangs; independent eyes and accessories."""
INK='#645d65'

def face(a):
    a.layer('ear-sl-complete','完整左耳','依据头部倾斜保守补全，原图大部分被耳饰及鬓发遮挡。',INK)
    a.surface('M444 194 C433 190 429 198 434 213 C436 225 442 238 450 238 C457 234 456 220 451 205 C449 199 448 195 444 194 Z')
    a.line('M441 203 C435 199 437 216 446 225 M440 214 C446 209 447 220 447 224',1.0,.7)

    a.layer('ear-sr-complete','完整右耳','被前发和耳侧组件覆盖的耳廓，作为隐藏结构保留。',INK)
    a.surface('M591 185 C598 177 607 183 605 196 C603 212 598 227 590 231 C581 232 579 221 583 207 C585 197 586 190 591 185 Z')
    a.line('M598 191 C603 190 600 207 590 218 M595 201 C588 199 589 211 589 215',1.0,.7)

    a.layer('face-complete','完整头面底形','从隐藏头顶、额头、太阳穴到面颊下颌连续闭合，未沿刘海切成可见碎片。',INK)
    a.surface('''M514 62 C472 59 442 85 434 125 C426 165 435 205 451 236
      C466 258 493 271 529 279 C550 266 574 247 585 224
      C599 193 608 151 599 115 C590 78 554 60 514 62 Z''',width=2.1,ident='complete-face-surface')
    a.guide('M501 87 C504 140 514 191 522 225 C526 246 528 261 529 273',dash='4 9')
    a.guide('M442 213 C478 205 545 191 590 181',dash='4 8')
    a.guide('M447 147 C481 141 550 128 590 128',dash='4 9')

    a.layer('face-nose-mouth','鼻口结构','保持小鼻部和略向画面右上抬起的微笑。',INK)
    a.line('M520 224 C518 226 519 228 521 228',.9,.62)
    a.line('M509 244 C516 250 531 247 540 239',1.5)
    a.line('M538 240 L541 237',1.35)
    a.line('M515 253 C520 255 527 254 531 252',.75,.4)

    a.layer('brow-sl-complete','完整左眉','隐藏在前发后面的内外延伸段也完整存在。','#667a83')
    a.surface('M453 168 C462 160 478 160 491 167 L497 174 C484 167 468 164 454 172 Z','#e3eaed',width=.8)
    a.layer('brow-sr-complete','完整右眉','单独绘制倾斜眉形，未镜像左眉。','#667a83')
    a.surface('M521 165 C532 154 547 149 561 148 L565 151 C548 151 534 158 523 168 Z','#e3eaed',width=.8)

    a.layer('eye-sl-complete','完整左眼','闭合眼裂；完整椭圆虹膜及瞳孔保留在眼睑之下，只做本眼内部裁剪。','#5b6976')
    d='M449 203 C460 193 478 192 493 198 C498 203 496 209 490 214 C477 222 460 217 449 203 Z'
    a.clip('clip-eye-sl',d)
    a.surface(d,width=1.0,ident='complete-eye-sl-aperture')
    a.oval(479.5,202.5,14.0,16.0,'#edf2f4',1.1,'clip-eye-sl','iris')
    a.oval(480.5,204,3.8,6.7,'#a3b1ba',.8,'clip-eye-sl','pupil')
    a.path('M468 205 C470 213 476 216 484 214','detail',stroke='#8d9fa9',width=1.0,clip='clip-eye-sl')
    a.oval(475,199,3.1,2.4,'#ffffff',.55,'clip-eye-sl','highlight',stroke='#c4cfd4')
    a.path('''M446 205 C451 198 456 195 461 192 L464 194 C475 191 487 192 495 197
      L499 202 C485 197 469 197 460 202 C458 205 457 208 459 211 Z''',
      'eyelash','#626b78',None)
    a.line('M450 200 L445 196 M456 196 L453 192',1.2)
    a.line('M464 216 C472 220 484 219 491 215',.9,.63)
    a.line('M459 187 C470 184 483 185 493 190',.85,.5)

    a.layer('eye-sr-complete','完整右眼','较高的眼位与独立眼型；虹膜在上睑后保持完整。','#5b6976')
    d='M535 192 C547 178 562 174 579 179 C578 190 570 197 558 199 C548 201 540 197 535 192 Z'
    a.clip('clip-eye-sr',d)
    a.surface(d,width=1.0,ident='complete-eye-sr-aperture')
    a.oval(558.5,185,13.5,17,'#edf2f4',1.1,'clip-eye-sr','iris')
    a.oval(558.7,187.5,3.7,6.8,'#a3b1ba',.8,'clip-eye-sr','pupil')
    a.path('M548 190 C551 196 559 199 566 192','detail',stroke='#8d9fa9',width=1.0,clip='clip-eye-sr')
    a.oval(553,182,3.0,2.5,'#ffffff',.55,'clip-eye-sr','highlight',stroke='#c4cfd4')
    a.path('''M532 195 C539 184 549 178 560 174 C568 171 575 171 580 174 L585 177
      L581 182 C570 176 554 180 543 187 Z''','eyelash','#626b78',None)
    a.line('M577 176 L583 172 M577 181 L581 178',1.3)
    a.line('M543 198 C554 203 566 198 572 194',.9,.6)
    a.line('M537 179 C547 174 557 170 567 169',.85,.5)

def accessories(a):
    a.layer('headgear-sl-ear','左耳侧组件','向鬓发与脸侧内部延伸的完整壳体。','#576372')
    a.surface('M433 202 L446 196 L477 261 L462 269 L451 257 Z','#e8edf0',width=1.6)
    a.surface('M440 208 L445 205 L469 258 L462 261 Z','#f9fafb',width=.85)
    a.line('M448 225 L458 247',.8,.6)

    a.layer('headgear-sr-ear','右耳侧组件','隐藏于右鬓发下的完整耳侧附件。','#576372')
    a.surface('M589 177 L607 181 L601 236 L582 247 L576 235 Z','#e8edf0',width=1.6)
    a.surface('M593 186 L600 187 L594 232 L586 237 Z','#f9fafb',width=.85)

    a.layer('headgear-sl-frame','左折线发饰','沿可见厚度补全内侧连接；刘海随后从上面覆盖。','#576372')
    a.surface('M424 40 L437 40 L451 65 L411 172 L386 134 Z','#e3e9ed',width=1.8)
    a.surface('M427 45 L433 46 L398 133 L411 154 L406 161 L393 135 Z','#f9fafb',width=.85)
    a.line('M437 40 L401 133 L414 158',.85,.5)

    a.layer('headgear-sr-frame','右折线发饰','较高的右发饰与独立倾斜方向；下端连接保留在前发下方。','#576372')
    a.surface('M573 27 L587 21 L644 97 L622 178 L605 177 L625 102 Z','#e3e9ed',width=1.8)
    a.surface('M580 29 L585 27 L635 99 L614 166 L617 143 L629 102 Z','#f9fafb',width=.85)
    a.line('M573 27 L631 103 L611 171',.85,.5)
