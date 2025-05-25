#version 300 es
precision mediump float;

in vec2 v_texCoord;
in vec4 v_color;

in float v_type;

out vec4 outColor;

void main() {

  vec2 uv = v_texCoord - 0.5;

  float circle = length(uv) - 0.5;

  float rect = max(abs(uv.x), abs(uv.y)) - 1.0;

  float shape = mix(rect, circle, v_type);

  float mask = smoothstep(0.0, 0.02, -shape);

  outColor = v_color * mask;
}