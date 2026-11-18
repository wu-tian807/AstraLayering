渲染本地 SVG，mode=svg 为白底独显，mode=edge 将红色填色边缘叠到参考图上。叠加比较仅提供 edge，须在 reference 中明确传入对应方向的参考帧路径，左上用 left-up.png，左下用 left-down.png。

SVG 与参考图使用相同尺寸和画布坐标，不自动对齐、居中或缩放参考。crop=[x,y,width,height] 只控制查看窗口，scale=1..8；referenceRegion/referenceOffset 不开放。输入文件不修改，返回图片与 savedPath。
