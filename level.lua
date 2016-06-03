
levels[#levels + 1] = [[
<svg width="320" height="480" xmlns="http://www.w3.org/2000/svg">
 <!-- Created with SVG-edit - http://svg-edit.googlecode.com/ -->

 <g>
  <title>ammo=299,timer=2,gravity=0.04,restitution=0.7,King Z</title>
  <rect transform="rotate(180, 142, -130)" id="svg_1" height="134" width="452" y="-197" x="-84.00002" fill="#000000" stroke="#000000"/>
  <rect height="68" width="168" y="130" x="82" fill="#000000" stroke="#000000" id="svg_10"/>
  <rect transform="rotate(90, -39, 148)" id="svg_16" height="110" width="452" y="93" x="-265" fill="#000000" stroke="#000000"/>
  <rect stroke="#000000" height="51.5" width="45.5" y="256.25" x="134.25" fill="#7fff00" id="svg_11"/>
  <rect id="svg_8" stroke="#000000" height="60" width="50" y="217" x="82" fill="#3f3f3f"/>
  <rect id="svg_13" height="134" width="452" y="79" x="144" fill="#000000" stroke="#000000" transform="rotate(-90, 370, 146)"/>
  <rect id="svg_9" stroke="#000000" height="60" width="50" y="187" x="82" fill="#3f3f3f"/>
  <rect id="svg_23" stroke="#000000" height="60" width="50" y="187" x="155" fill="#3f3f3f"/>
  <rect id="svg_24" stroke="#000000" height="60" width="50" y="177" x="214" fill="#3f3f3f"/>
  <rect id="svg_25" stroke="#000000" height="60" width="50" y="222" x="213" fill="#3f3f3f"/>
  <rect id="svg_26" stroke="#000000" height="60" width="50" y="258" x="212" fill="#3f3f3f"/>
  <rect id="svg_15" height="134" width="452" y="307.58331" x="-80.91669" fill="#000000" stroke="#000000"/>
  <rect id="svg_17" height="110" width="452" y="379" x="-44" fill="#000000" stroke="#000000"/>
 </g>
</svg>
]]
hints[#levels]= {
	time = 200, x = 166, y = 120, xc = 200, yc = 200, txt1 = "oh my", txt2 = "!"
}

hatCount = 14

Level = Core.class(Body)

function Level:init(i)
	local level = self
	level.i = i
	-- level.background = Bitmap.new(backgroundTextures[1 + (math.floor((6 + i) / 7) - 1) % #backgroundTextures])
	level.background = Bitmap.new(backgroundTextures[1 + (i - 1) % #backgroundTextures])
	level.background:setScale(1.1)
	level.background:setAnchorPoint(0.5, 0.5)
	level.background:setPosition(stageW / 2, stageH / 2)
	-- local textureGround = groundTextures[1 + (math.floor((6 + i) / 7) - 1) % #groundTextures]
	local textureGround = groundTextures[1 + (i - 1) % #groundTextures]

	level:addChild(level.background)
	level.innerWorld = Body.createWorld("level" .. level.i)
	level.zombiLayer = Sprite.new()
	level.bombLayer = Sprite.new()
	level.platformLayer = Sprite.new()
	level.zombiCount = 0

	-- print("load", i)
	level.hint = hints[i]
	level.tuto = tutos[i]
	level.tutoTxt = tutoTxts[i]
	input = i > #levels and levels[#levels] or levels[i] 
	if not input then print(i) end
	level.xRena = stageW / 3
	level.yRena = stageH / 3
	
	level.gravity = 0.03; -- + level.i / 100
	-- level.bombGravity = (level.i >= 10 and 0.02 + (level.i - 10) / 100 or 0)
	-- level.friction = -0.02
	level.friction = nil



	input:gsub( --   <title>Layer 1</title>
	  [[<title>([^<]+)</title>]],
		function(title)
			for _, variable in pairs({"life", "ammo", "gravity", "timer", "friction", "hat", "par", "restitution"}) do
			
				local m = title:match(variable .. [[=[^\,]+,]])
				if m ~= nil then
					
					level[variable] = m:gsub(variable .. [[=([^\,]+),]], "%1")
					-- print(variable, level[variable])
					level[variable] = tonumber(level[variable])
				    title = title:gsub(variable .. [[=[^\,]+,]], '')
				end
			end
			if not title:match([[Layer]]) then
				level.title = title
			end
		end
	)
	level.innerWorld:setGravity(0, 98 * level.gravity)
	if level.gravity == 0 then
		level.background:setTexture(Texture.new("sky.png"))
	end
	if level.friction == nil then
		level.friction = (level.gravity  == 0) and 0.4 or 1.0
	end
	input:gsub(
	  [[<rect( [^>]+)>]],
	  function(rect)
		local id = rect:match([[%sid="[^\"]+"]]):gsub([[id="([^\"]+)"]], "%1")
		local height = rect:match([[%sheight="[^\"]+"]]):gsub([[height="([^\"]+)"]], "%1")
		local width = rect:match([[%swidth="[^\"]+"]]):gsub([[width="([^\"]+)"]], "%1")
		local y = rect:match([[%sy="[^\"]+"]]):gsub([[y="([^\"]+)"]], "%1")
		local x = rect:match([[%sx="[^\"]+"]]):gsub([[x="([^\"]+)"]], "%1")
		local fill = rect:match([[%sfill="[^\"]+"]]):gsub([[fill="#([^\"]+)"]], "%1")
		local stroke = rect:match([[%sstroke="[^\"]+"]]):gsub([[stroke="#([^\"]+)"]], "%1")
		local angle, centerX, centerY = nil, nil, nil
	    local rotate = rect:match([[%stransform="rotate%([^%s]+ [^%s]+ [^)]+%)"]])
		if (rotate ~= nil) then
			rotate = rotate:gsub(",", "")
			rotate:gsub([[%(([^%s]+) ([^%s]+) ([^\)]+)%)]],
				function(a,x2,y2)
					angle, centerX, centerY = a, x2, y2
				end)
		end
		centerX = centerX and tonumber(centerX) or x + width / 2

		centerY = centerY and tonumber(centerY) or y + height / 2
		x, y, width, height = tonumber(x), tonumber(y), tonumber(width), tonumber(height)
		-- print('rect', angle, centerX, centerY, id, height, width, y, x, stroke, fill)
		
		if (y ~= nil) then
			if (fill == ' 7fff00') then
				-- renabomb initial position
				level.xRena = x + width / 2
				level.yRena = y + height
				
			elseif (fill == ' ff0000') then
				-- one zombi
				local z = Zombi.new(zombiStandingRegions[1], level, x, x + width, y + height)
			elseif (fill == ' ffff00') then
				-- one sleepy bomb
				local bomb = Bomb.new(bombRegions[1], level, "sleepy")
				bomb:setPosition(centerX, centerY)

				
			elseif (fill == ' ff00ff') then
				-- one door (breakable obstacle)
				local door = BitmapBody.new(textureDoor)
				-- print('angle', angle)
				door:setAnchorPoint(0.5, 0.5)
				door:setPosition(x + door:getWidth() / 2, y + door:getHeight() / 2)
				if angle then
					-- horizontal door are floating
					door:setRotation(angle)
					door.floating = true
				end
				door.shape = b2.PolygonShape.new()
				door.shape:setAsBox(10, 30, 0, 0, 0)
				door:setWorld(level.innerWorld, Body.BLOCK, false,
						{categoryBits = 8, maskBits = 15})
				door.life = 40

				function door:onHit(damage, d, a)
					self.life = self.life - damage
					if self.life < 0 then
						self.angleSpeed = 3 * (math.random(5) - 3.5)
						local xs, ys = self:getSpeed()
						self:setSpeed((xs or self.angleSpeed) * 3, (ys or 1) * 2 - 2)
						self.acceleration = -0.02
						self.fade = -0.02
						self:setWorld(nil)
						self:setTtl(160)
					end
				
					local points = math.floor(damage / 10) * 100
					score = score + points
					local xm, ym = self:getPosition()
					bill(xm, ym, string.format("%d", points), 0xFFFF00, 1 + damage / 10)
				end

				--door.friction = level.friction
				level:addMovingChild(door)



			else
				local shape = Shape.new()
				local platform = false
				-- print(fill)
				if (fill == ' 000000') then
					-- one platform
					platform = true
					local m = Matrix.new(1, 0, 0, 1, x - centerX, y - centerY)
					if (angle) then
						local angle2=0
						if (width < height) then
							-- print(angle)
							if (tonumber(angle) < 0) then
								angle2 = -90 / 180 * math.pi
							else
								angle2 = 90 / 180 * math.pi
							end
						end
						if (angle2 ~= 0) then
						
							m:setM11(math.cos(angle2))
							m:setM12(math.sin(angle2))
							m:setM21(-math.sin(angle2))
							m:setM22(math.cos(angle2))
							if (angle2 < 0) then
								m:setTx(x - centerX + width)
							else
								m:setTy(y - centerY + height)
							end
						else
							--m:setTx(x - centerX + 40)
							--m:setTy(y - centerY)
						end
					end					
					shape:setFillStyle(Shape.TEXTURE, textureGround, m)

				elseif (fill == ' 3f3f3f') then
					-- foilage
					width = 64
					height = 64
					x = centerX - 32
					y = centerY - 32
					local m = Matrix.new(1, 0, 0, 1,(math.fmod(math.ceil(x), 2) == 1 and -96 or -32), -32 - ((i - 1) % 4) * 64)
					shape:setFillStyle(Shape.TEXTURE, textureLeafs, m)
					
				else
					shape:setLineStyle(1, tonumber(stroke, 16), 0.5)
					-- shape:setFillStyle(Shape.SOLID, tonumber(fill, 16), 0.1)
				end

			    -- shape:setLineStyle(1, tonumber(stroke, 16), 0.5)
				shape:beginPath()
				shape:moveTo(x - centerX, y - centerY)
				shape:lineTo(x + width - centerX, y - centerY)
				shape:lineTo(x + width - centerX, y + height - centerY)
				shape:lineTo(x - centerX , y + height - centerY)
				shape:closePath()
				shape:endPath()
				
				-- rect middle in Shape reference
				--shape.x0 = x - centerX + (width / 2)
				--shape.y0 = y - centerY + (height / 2)
				--print(shape.x0, shape.y0)
				if platform then
					local body = Body.new()
					body:addChild(shape)
					shape = body
					shape:setPosition(centerX, centerY)
					shape.bodyWidthPadding = 6;
					shape.bodyHeightPadding = 6;
					shape.restitution = level.restitution
					level.platformLayer:addMovingChild(shape)
				else
					shape:setPosition(centerX, centerY)
					level.platformLayer:addChild(shape)
				end

				shape.w = width
				shape.h = height
				_ = platform and shape:setWorld(level.innerWorld, Body.BLOCK, true)
				if (angle) then shape:setRotation(angle) end
	
			end
		end
      end	
	)

	if level.i == #levels then
		local boss = Boss.new(zombiStandingRegions[1], level, stageW / 2, stageH / 5)
	end
	
	level:addChild(level.platformLayer)
	level:addChild(level.zombiLayer)
	level:addChild(level.bombLayer)
	-- print("loaded")
end

function Level:finalize()
    -- print("Level:finalize()", self.i)
	while game.running and self.zombiLayer:getNumChildren() > 0 do
		local zombi = self.zombiLayer:getChildAt(1)
		zombi:setState(state.dead)
	end

	while self.bombLayer:getNumChildren() > 0 do
		self.bombLayer:getChildAt(1):stop()
	end
	
	if game.running and self.zombiCount > 0 then
		error("zombi not dead")
	end
	
	while self:getNumChildren() > 0 do
		local child = self:getChildAt(1)
		if (child.moving) then
			child:freeze()
		end
		child:removeFromParent()
	end
	
	-- Body._clearRemoved() -- FIXME why?
	self:stop()
	self.innerWorld:clear()
	
	if level == self then
	    level = nil
	end
	
	-- print("cleaned", Sprite.movingCount)
end

function Level:focus()
	_= rena:getParent() and rena:removeFromParent()
	-- stage:addChildAt(stage.particles, stage:getChildIndex(frame))
	stage:addChildAt(self, stage:getChildIndex(stage.particles))
	
	stage.gravity = self.gravity
	
	rena.friction = self.friction
	rena:setRotation(0)
	rena.floating = false
	rena:freeze()
	rena:setWorld(self.innerWorld)
	self:addMovingChild(rena)
	rena:setSpeed(0, 0)
	rena.gravity = nil
	rena:setTextureLoop(standingRegions, 5)
	-- rena.iterate = nil
	rena:setPosition(self.xRena, self.yRena)

	if (self.xRena > stageW / 2) then
		rena.flip = true
		rena:setScaleX(-2)
	else
		rena.flip = false
		rena:setScaleX(2)
	end
	
	if (self.ammo ~= nil) then
		ammo = self.ammo
	else
		ammo = 90 - self.i * 10
		if (ammo <= 15) then ammo = 15 end
	end
	
	txtAmmo:setText(string.format("%02d @", ammo))
	assert(self.innerWorld)
	--self.platformLayer:removeFromParent()
    --self.foreground = RenderTarget.new(stageW, stageH, false)
	--self.foreground:draw(self.platformLayer)
	--self:addChild(Bitmap.new(self.foreground))	
	level = self
end
