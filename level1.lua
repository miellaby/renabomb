levels = levels or {}
hints = hints or {}
tutos = tutos or {}
tutoTxts = tutoTxts or {}
alternateGuiLayouts = alternateGuiLayouts or {}

levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>timer=2,restitution=0.3,Easy One</title>
  <rect id="svg_1" height="134" width="452" y="250" x="165.99998" fill="#000000" stroke="#000000"/>
  <rect id="svg_3" height="50" width="79" y="203.9632" x="195.29765" fill="#ff0000" stroke="#000000"/>
  <rect height="134" width="452" y="172.5" x="-281" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect stroke="#000000" height="55" width="32" y="121" x="129" fill="#7fff00" id="svg_11"/>
  <rect stroke="#000000" height="60" width="32" y="105" x="-19.5" fill="#3f3f3f" id="svg_12"/>
  <rect id="svg_4" stroke="#000000" height="60" width="32" y="226" x="130" fill="#3f3f3f"/>
  <rect id="svg_5" stroke="#000000" height="60" width="32" y="289" x="148" fill="#3f3f3f"/>
  <rect id="svg_6" stroke="#000000" height="60" width="32" y="332" x="144" fill="#3f3f3f"/>
  <rect id="svg_8" stroke="#000000" height="60" width="32" y="278" x="125" fill="#3f3f3f"/>
  <rect id="svg_13" height="134" width="452" y="-35" x="119.99998" fill="#000000" stroke="#000000" transform="rotate(-90, 346, 32)"/>
  <rect id="svg_9" stroke="#000000" height="60" width="32" y="240" x="156" fill="#3f3f3f"/>
  <rect id="svg_2" stroke="#000000" height="60" width="32" y="262" x="141" fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="136.08334" x="-14.91666" fill="#3f3f3f" id="svg_7"/>
  <rect stroke="#000000" height="60" width="32" y="120.08464" x="-28.91534" fill="#3f3f3f" id="svg_14"/>
 </g>
</svg>
]]
tutos[#levels] = 'tuto1.png'
tutoTxts[#levels] = 'Touch screen to shoot'
hints[#levels] = {
	time = 100, x = 140, y = 140, xc = 130, yc = 40, txt1 = "I'm", txt2 = "Renabomb",
	next = {
		time = 160, x = 240, y = 420, xc = 170, yc = 340, txt1 = "I've got", txt2 = "bombs",
		next = {
			time = 160, x = 230, y = 240, xc = 260, yc = 150, txt1 = "explode", txt2 = "bad guy!",
			next = {
				time = 500, x = 230, y = 240, xc = 260, yc = 150, txt1 = "Tap", txt2 = "now!"
			}
		}
	}
}


levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>timer=3,Snooker</title>
  <rect id="svg_16" transform="rotate(90, -37, -38)" height="110" width="452" y="-93" x="-263" fill="#000000" stroke="#000000"/>
  <rect transform="rotate(180, 132, -51)" id="svg_1" height="134" width="452" y="-118" x="-94" fill="#000000" stroke="#000000"/>
  <rect id="svg_3" height="50" width="99" y="50" x="18" fill="#ff0000" stroke="#000000"/>
  <rect height="88" width="452" y="100" x="-315" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect stroke="#000000" height="44" width="27" y="252" x="133" fill="#7fff00" id="svg_11"/>
  <rect id="svg_15" height="134" width="452" y="300" x="-275" fill="#000000" stroke="#000000"/>
  <rect id="svg_4" stroke="#000000" height="60" width="32" y="319" x="62" fill="#3f3f3f"/>
  <rect id="svg_5" stroke="#000000" height="60" width="32" y="320" x="267" fill="#3f3f3f"/>
  <rect id="svg_6" stroke="#000000" height="60" width="32" y="311" x="108" fill="#3f3f3f"/>
  <rect id="svg_8" stroke="#000000" height="60" width="32" y="105" x="109" fill="#3f3f3f"/>
  <rect id="svg_13" height="134" width="452" y="143" x="65" fill="#000000" stroke="#000000" transform="rotate(-90, 291, 210)"/>
  <rect id="svg_9" stroke="#000000" height="60" width="32" y="146" x="113" fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="103" x="227" fill="#3f3f3f" id="svg_7"/>
  <rect stroke="#000000" height="60" width="32" y="169" x="219" fill="#3f3f3f" id="svg_14"/>
  <rect stroke="#000000" height="60" width="32" y="132" x="217" fill="#3f3f3f" id="svg_12"/>
  <rect id="svg_2" stroke="#000000" height="60" width="32" y="341" x="95" fill="#3f3f3f"/>
 </g>
</svg>
]]
tutos[#levels] = 'tuto2.png'
tutoTxts[#levels] = 'Throw many at a time!'
alternateGuiLayouts[#levels] = true
hints[#levels]  = {
	time = 160, x = 200, y = 170, xc = 220, yc = 70, txt1 = "think", txt2 = "\'pool shot\'"
}

levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>timer=3,restitution=0.3,Mole Hole</title>
  <rect stroke="#000000" fill="#000000" x="-155.00002" y="445" width="452" height="134" id="svg_1"/>
  <rect stroke="#000000" fill="#ff0000" x="177.29794" y="392.9632" width="107.99999" height="50" id="svg_3"/>
  <rect id="svg_10" stroke="#000000" fill="#000000" x="-233" y="251" width="452" height="134"/>
  <rect id="svg_11" fill="#7fff00" x="28" y="207" width="27" height="44" stroke="#000000"/>
  <rect stroke="#000000" fill="#3f3f3f" x="184" y="255" width="32" height="60" id="svg_4"/>
  <rect fill="#3f3f3f" x="174" y="288" width="32" height="60" stroke="#000000" id="svg_5"/>
  <rect fill="#3f3f3f" x="174" y="334" width="32" height="60" stroke="#000000" id="svg_8"/>
  <rect transform="rotate(-90 348 340)" stroke="#000000" fill="#000000" x="121.99998" y="273" width="452" height="134" id="svg_13"/>
  <rect stroke="#000000" fill="#000000" x="250" y="252" width="452" height="134" id="svg_15"/>
  <rect fill="#3f3f3f" x="249" y="314" width="32" height="60" stroke="#000000" id="svg_9"/>
  <rect fill="#3f3f3f" x="251" y="256" width="32" height="60" stroke="#000000" id="svg_2"/>
  <rect id="svg_7" fill="#3f3f3f" x="182" y="308.08334" width="32" height="60" stroke="#000000"/>
  <rect id="svg_14" fill="#3f3f3f" x="239" y="270.08464" width="32" height="60" stroke="#000000"/>
  <rect fill="#3f3f3f" x="250" y="333" width="32" height="60" stroke="#000000" id="svg_6"/>
 </g>
</svg>
]]
hints[#levels]  = {
	time = 100, x = 230, y = 300, xc = 230, yc = 200, txt1 = "Play", txt2 = "Golf! :)",
	next = {
		time = 1000, x = 300, y = 230, xc = 200, yc = 120, txt1 = "Try", txt2 = "here ;)"
	}
}

levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg" xmlns:svg="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->
 <g>
  <title>restitution=0.6,Mouse Hole</title>
  <rect id="svg_1" height="134" width="452" y="300" x="-304" fill="#000000" stroke="#000000"/>
  <rect id="svg_3" height="50" width="50" y="232" x="252" fill="#ff0000" stroke="#000000"/>
  <rect transform="rotate(-5, 282, 351)" height="134" width="452" y="284.5" x="57" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect stroke="#000000" height="45" width="28" y="183" x="27" fill="#7fff00" id="svg_11"/>
  <rect id="svg_5" stroke="#000000" height="60" width="32" y="320" x="267" fill="#3f3f3f"/>
  <rect id="svg_6" stroke="#000000" height="60" width="32" y="332" x="164" fill="#3f3f3f"/>
  <rect id="svg_13" height="134" width="452" y="-19" x="-64" fill="#000000" stroke="#000000" transform="rotate(-95, 162, 48)"/>
  <rect stroke="#000000" height="60" width="32" y="138" x="178" fill="#3f3f3f" id="svg_12"/>
  <rect id="svg_9" stroke="#000000" height="60" width="32" y="304" x="243" fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="107" x="183" fill="#3f3f3f" id="svg_7"/>
  <rect stroke="#000000" height="60" width="32" y="175" x="181" fill="#3f3f3f" id="svg_14"/>
  <rect id="svg_15" height="134" width="452" y="224" x="-386" fill="#000000" stroke="#000000"/>
  <rect id="svg_2" stroke="#000000" height="60" width="32" y="276" x="37" fill="#3f3f3f"/>
  <rect id="svg_8" stroke="#000000" height="60" width="32" y="313" x="51" fill="#3f3f3f"/>
  <rect height="134" width="452" y="14" x="158" fill="#000000" stroke="#000000" transform="rotate(-85, 384, 81)" id="svg_4"/>
 </g>
</svg>
]]

tutos[#levels] = 'tuto4.png'
tutoTxts[#levels] = 'Blasts push bombs!'
hints[#levels]  = {
	time = 100, x = 180, y = 270, xc = 200, yc = 170, txt1 = "blow bombs", txt2 = "with bombs"
}


levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>restitution=0.5,Me Bouncy</title>
  <rect id="svg_1" height="134" width="452" y="120.5" x="138.99998" fill="#000000" stroke="#000000"/>
  <rect id="svg_3" height="50" width="139.00001" y="74.9632" x="153.29823"  fill="#ff0000" stroke="#000000"/>
  <rect height="452" width="134" y="-264.5" x="-101" fill="#000000" stroke="#000000" id="svg_7" transform="rotate(-3.46823 -34 -38.5)"/>
  <rect height="134" width="452" y="330.5" x="-238" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect stroke="#000000" height="44.5" width="27.5" y="288.25" x="27.25"  fill="#7fff00" id="svg_11"/>
  <rect stroke="#000000" height="60" width="32" y="152" x="-19.5"  fill="#3f3f3f" id="svg_12"/>
  <rect id="svg_2" stroke="#000000" height="60" width="32" y="207" x="139"  fill="#3f3f3f"/>
  <rect id="svg_4" stroke="#000000" height="60" width="32" y="173" x="147"  fill="#3f3f3f"/>
  <rect id="svg_5" stroke="#000000" height="60" width="32" y="389" x="176"  fill="#3f3f3f"/>
  <rect id="svg_6" stroke="#000000" height="60" width="32" y="416" x="164"  fill="#3f3f3f"/>
  <rect id="svg_8" stroke="#000000" height="60" width="32" y="391" x="145"  fill="#3f3f3f"/>
  <rect id="svg_9" stroke="#000000" height="60" width="32" y="155" x="290"  fill="#3f3f3f"/>
 </g>
</svg>
]]
alternateGuiLayouts[#levels] = true
tutos[#levels] = 'tuto3.png'
tutoTxts[#levels] = 'Go strong by bouncing!'
hints[#levels]  = {
	time = 160, x = 150, y = 200, xc = 100, yc = 100, txt1 = "bounce", txt2 = "to go strong"
}


levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->
 <g>
  <title>timer=2,friction=0.13,Come Here!</title>
  <rect stroke="#000000" fill="#000000" x="218.16665" y="20.16862" width="452" height="134" transform="rotate(-14.824, 444.167, 87.1686)" id="svg_7"/>
  <rect stroke="#000000" fill="#000000" x="130.99998" y="298" width="452" height="134" id="svg_1" transform="rotate(-14.824, 357, 365)"/>
  <rect stroke="#000000" fill="#ff0000" x="233.29739" y="10.9632" width="53" height="50" id="svg_3"/>
  <rect id="svg_10" stroke="#000000" fill="#000000" x="-283" y="-16.5" width="452" height="118"/>
  <rect id="svg_11" fill="#7fff00" x="121.25" y="225.25" width="27.5" height="44.5" stroke="#000000"/>
  <rect stroke="#000000" fill="#000000" x="-285.91669" y="269.58331" width="452" height="134" id="svg_15"/>
  <rect fill="#3f3f3f" x="133" y="308" width="32" height="60" stroke="#000000" id="svg_4"/>
  <rect fill="#3f3f3f" x="267" y="320" width="32" height="60" stroke="#000000" id="svg_5"/>
  <rect fill="#3f3f3f" x="148" y="316" width="32" height="60" stroke="#000000" id="svg_6"/>
  <rect transform="rotate(-90, 275, 308)" stroke="#000000" fill="#000000" x="48.99998" y="241" width="452" height="134" id="svg_13"/>
  <rect id="svg_12" fill="#3f3f3f" x="138.5" y="280" width="32" height="60" stroke="#000000"/>
  <rect fill="#3f3f3f" x="133" y="352" width="32" height="60" stroke="#000000" id="svg_2"/>
  <ellipse fill="#000000" stroke="#000000" cx="272.08333" cy="750.16666" id="svg_16" ry="1"/>
  <ellipse fill="#000000" stroke="#000000" cx="448.08333" cy="886.16666" id="svg_17" ry="3"/>
  <rect id="svg_9" fill="#3f3f3f" x="137.5" y="88" width="32" height="60" stroke="#000000"/>
  <rect id="svg_14" fill="#3f3f3f" x="152.5" y="96" width="32" height="60" stroke="#000000"/>
  <rect id="svg_18" fill="#3f3f3f" x="143" y="60" width="32" height="60" stroke="#000000"/>
  <rect id="svg_19" fill="#3f3f3f" x="137.5" y="132" width="32" height="60" stroke="#000000"/>
 </g>
</svg>
]]
alternateGuiLayouts[#levels] = true
hints[#levels]  = {
	time = 200, x = 200, y = 330, xc = 80, yc = 350, txt1 = "could go", txt2 = "there?"
}


levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>gravity=0.03,The Wall</title>
  <rect transform="rotate(169.447, 112, 14)" id="svg_1" height="134" width="452" y="-53" x="-114" fill="#000000" stroke="#000000"/>
  <rect id="svg_3" height="50" width="95.99999" y="331.9632" x="195.29781" fill="#ff0000" stroke="#000000"/>
  <rect height="134" width="452" y="276" x="286" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect stroke="#000000" height="44.5" width="27.5" y="335.25" x="21.25" fill="#7fff00" id="svg_11"/>
  <rect id="svg_15" height="134" width="452" y="380" x="-39" fill="#000000" stroke="#000000"/>
  <rect id="svg_4" stroke="#000000" height="60" width="32" y="330" x="155" fill="#3f3f3f"/>
  <rect id="svg_6" stroke="#000000" height="60" width="32" y="338" x="170" fill="#3f3f3f"/>
  <rect id="svg_8" stroke="#000000" height="60" width="32" y="68" x="29" fill="#3f3f3f"/>
  <rect id="svg_13" height="116" width="449" y="359" x="-86" fill="#000000" stroke="#000000" transform="rotate(-90, 139, 417.5)"/>
  <rect id="svg_9" stroke="#000000" height="60" width="32" y="358" x="169" fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="50" x="133" fill="#3f3f3f" id="svg_7"/>
  <rect stroke="#000000" height="60" width="32" y="41" x="139" fill="#3f3f3f" id="svg_14"/>
  <rect stroke="#000000" height="60" width="32" y="234" x="161" fill="#3f3f3f" id="svg_12"/>
  <rect id="svg_2" stroke="#000000" height="60" width="32" y="201" x="169" fill="#3f3f3f"/>
  <ellipse ry="1" id="svg_16" cy="750.16666" cx="272.08333" stroke="#000000" fill="#000000"/>
  <ellipse ry="3" id="svg_17" cy="886.16666" cx="448.08333" stroke="#000000" fill="#000000"/>
  <rect id="svg_5" stroke="#000000" height="60" width="32" y="280" x="168" fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="315" x="161" fill="#3f3f3f" id="svg_18"/>
 </g>
</svg>
]]
alternateGuiLayouts[#levels] = true
hints[#levels]  = {
	time = 160, x = 90, y = 100, xc = 120, yc = 50, txt1 = "big arrows", txt2 = "shoot far"
}

levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>timer=2,hat=1,Hide&Seek</title>
  <rect id="svg_1" height="105" width="452" y="41.00009" x="-31.00002" fill="#000000" stroke="#000000" transform="rotate(180, 195, 93.5)"/>
  <rect id="svg_3" height="50" width="53" y="149.9632" x="181.29739"  fill="#ff0000" stroke="#000000"/>
  <rect height="134" width="130" y="202.5" x="87" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect stroke="#000000" height="44.5" width="27.5" y="350.25" x="22.25"  fill="#7fff00" id="svg_11"/>
  <rect id="svg_15" height="134" width="452" y="396.58331" x="-240.91669" fill="#000000" stroke="#000000"/>
  <rect id="svg_4" stroke="#000000" height="60" width="32" y="249" x="146"  fill="#3f3f3f"/>
  <rect id="svg_6" stroke="#000000" height="60" width="32" y="215" x="125"  fill="#3f3f3f"/>
  <rect id="svg_8" stroke="#000000" height="60" width="32" y="285" x="189"  fill="#3f3f3f"/>
  <rect id="svg_13" height="33" width="190.00001" y="213.50001" x="63.49995" fill="#000000" stroke="#000000" transform="rotate(-90, 158.5, 230)"/>
  <rect id="svg_9" stroke="#000000" height="60" width="32" y="271" x="132"  fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="237.08334" x="191.08334"  fill="#3f3f3f" id="svg_7"/>
  <rect stroke="#000000" height="60" width="32" y="205.08464" x="190.08466"  fill="#3f3f3f" id="svg_14"/>
  <rect stroke="#000000" height="60" width="32" y="104" x="281.5"  fill="#3f3f3f" id="svg_12"/>
  <rect id="svg_2" stroke="#000000" height="60" width="32" y="122" x="243"  fill="#3f3f3f"/>
  <ellipse ry="1" id="svg_16" cy="750.16666" cx="272.08333"  stroke="#000000" fill="#000000"/>
  <ellipse ry="3" id="svg_17" cy="886.16666" cx="448.08333"  stroke="#000000" fill="#000000"/>
  <rect id="svg_5" stroke="#000000" height="60" width="32" y="225" x="131"  fill="#3f3f3f"/>
  <rect stroke="#000000" height="60" width="32" y="106.08334" x="226.08334"  fill="#3f3f3f" id="svg_18"/>
 </g>
</svg>
]]
hints[#levels]  = {
	time = 50, x = 230, y = 150, xc = 260, yc = 100, txt1 = "\"me so", txt2 = "hip!\"",
	next = {
		time = 160, x = 150, y = 200, xc = 100, yc = 120, txt1 = "blow it", txt2 = "away!!"
	}
}

levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>timer=3.5,ammo=8,gravity=0.04,Basket</title>
  <rect stroke="#000000" fill="#ff0000"  x="218.29733" y="31.9632" width="46" height="50" id="svg_3"/>
  <rect id="svg_10" stroke="#000000" fill="#000000" x="-266" y="317.5" width="452" height="134"/>
  <rect id="svg_11" fill="#7fff00"  x="16.25" y="270.25" width="27.5" height="44.5" stroke="#000000"/>
  <rect id="svg_12" fill="#3f3f3f"  x="177" y="105" width="32" height="60" stroke="#000000"/>
  <rect fill="#3f3f3f"  x="257" y="86" width="32" height="60" stroke="#000000" id="svg_4"/>
  <rect fill="#3f3f3f"  x="265" y="149" width="32" height="60" stroke="#000000" id="svg_5"/>
  <rect fill="#3f3f3f"  x="261" y="192" width="32" height="60" stroke="#000000" id="svg_6"/>
  <rect fill="#3f3f3f"  x="242" y="138" width="32" height="60" stroke="#000000" id="svg_8"/>
  <rect transform="rotate(-90, 201.5, 116)" stroke="#000000" fill="#000000" x="156.49999" y="107.49998" width="90" height="17" id="svg_13"/>
  <rect fill="#3f3f3f"  x="273" y="99" width="32" height="60" stroke="#000000" id="svg_9"/>
  <rect fill="#3f3f3f"  x="258" y="122" width="32" height="60" stroke="#000000" id="svg_2"/>
  <rect id="svg_7" fill="#3f3f3f"  x="181" y="184.08334" width="32" height="60" stroke="#000000"/>
  <rect id="svg_14" fill="#3f3f3f"  x="177" y="137.08464" width="32" height="60" stroke="#000000"/>
  <rect stroke="#000000" fill="#000000" x="192.99995" y="145" width="100" height="18" id="svg_15"/>
  <rect stroke="#000000" fill="#000000" x="60.66671" y="146.1677" width="452" height="29" id="svg_17" transform="rotate(-90, 286.668, 160.668)"/>
  <rect stroke="#000000" fill="#000000" x="-38.83334" y="352.66667" width="452" height="134" id="svg_18"/>
 </g>
</svg>
]]

alternateGuiLayouts[#levels] = true
hints[#levels]  = {
	time = 160, x = 240, y = 420, xc = 170, yc = 340, txt1 = "bombs got", txt2 = "scarcer"
}

