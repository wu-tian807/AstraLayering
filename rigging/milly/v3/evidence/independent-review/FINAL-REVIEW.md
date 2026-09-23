# v3 独立定向复验：通过

最终候选：`/Users/wutian/Desktop/coding/AstraLayering/rigging/milly/v3/index.html`。

- HTML SHA-256：`73793ae5b40ac65c31edadd981a90da9cc90e280ad53bf838f30308ca71c2f6f`
- rig.js SHA-256：`d649458b7a6da3d483ee60c5bed241bf006b65940a3785397f4442bb6d1f3ff9`
- SVG SHA-256：`61fda051b2df6cba5faed60bd02af459e33d0d7bbd428097f9ce292000860aad`

最终冻结快照和完整哈希在 `final-2/`。报告写入时HTML与冻结版一致。只读实现，自行渲染，未修改候选。

本轮用户指出的肩帽重复边、骨盆封口横线，在中性、转身、俯仰、外展、收背中已消失，真实服装包边保留，未见新的肩髋横向色块接缝。证据 `body-contact.jpg` 与相关原图。

最大左右转头幅度明显收小，脸宽和近远眼关系温和，闭眼偏头不再明显压扁；正负俯仰、组合角度的五官/脸色仍连接。证据 `face-left.png`、`face-right.png`、`face-closed-turn.png`、`face-combination.png`。

连续播放和无风平滑转向中，侧发与呆毛在头部到位后继续回摆，发根连接；没有用逐帧seek代替惯性检查。证据 `return-contact.jpg`、`smooth-contact.jpg`。后续头部缓存为性能整理，沿用上述已通过视觉检查。

邻接问题V3-N1已关闭：收背14度及10–12度腿间露出的交叉手指消失；最终另外目视6/8度和14度相邻姿态，无新截口或填色断层。证据 `final-2/tuck-detail-contact.jpg` 与原图。后续抬腕修改不改变已审肩髋结构、头脸或物理公式。

本轮定向检查无剩余已确认问题。首轮问题记录见 `REVIEW-INITIAL.md`；中间 `final/` 的10/12度问题已由 `final-2/` 关闭。功能/性能全量测试由主流程完成，本报告不重复。
