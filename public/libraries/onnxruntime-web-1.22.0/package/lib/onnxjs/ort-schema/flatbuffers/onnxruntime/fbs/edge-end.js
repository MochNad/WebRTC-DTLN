'use strict';
// automatically generated by the FlatBuffers compiler, do not modify
Object.defineProperty(exports, '__esModule', { value: true });
exports.EdgeEnd = void 0;
class EdgeEnd {
  constructor() {
    this.bb = null;
    this.bb_pos = 0;
  }
  __init(i, bb) {
    this.bb_pos = i;
    this.bb = bb;
    return this;
  }
  nodeIndex() {
    return this.bb.readUint32(this.bb_pos);
  }
  srcArgIndex() {
    return this.bb.readInt32(this.bb_pos + 4);
  }
  dstArgIndex() {
    return this.bb.readInt32(this.bb_pos + 8);
  }
  static sizeOf() {
    return 12;
  }
  static createEdgeEnd(builder, node_index, src_arg_index, dst_arg_index) {
    builder.prep(4, 12);
    builder.writeInt32(dst_arg_index);
    builder.writeInt32(src_arg_index);
    builder.writeInt32(node_index);
    return builder.offset();
  }
}
exports.EdgeEnd = EdgeEnd;
//# sourceMappingURL=edge-end.js.map
