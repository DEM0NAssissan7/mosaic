const st = imports.gi.St;
const main = imports.ui.main;

function rect(x, y, width, height) {
    const box = new st.BoxLayout({ style_class: "feedforward" });
    box.x = x;
    box.y = y;
    box.width = width;
    box.height = height;
    main.uiGroup.add_actor(box);
}