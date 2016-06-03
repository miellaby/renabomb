Bomb = Core.class(BitmapBody)
function Bomb:burn()
	if (Body.iteration - self.t0) * 1.25 < self.ttl then
	    local x, y = self:localToGlobal(24, -24)
	    local xs, ys = self:getSpeed()
		sparkle(x, y, xs / 5, ys / 5, self.strength)
	elseif self.regions == nil then
		_= soundOn and sound('timer0', true):stop()
		_= soundOn and sound('dring')
		self:setTextureLoop(bombRegions, 3)
	end
end
	
function Bomb:onBounce()
	if game.state ~= state.ingame and game.state ~= state.timeout then
		return
	end
	if self.ibling < Body.iteration - 10 then
		self.ibling = Body.iteration
		local d = math.sqrt(self.xSpeed * self.xSpeed + self.ySpeed * self.ySpeed)
		if d > 2 then
			if self.timer and self.strength == 0 then
				self.strength = 3
				self:setTtl(self.timer)
				self.iterate = Bomb.burn
			end
			local x, y = self:getPosition()
			bling(x, y, -self.xSpeed, -self.ySpeed, self.strength + math.floor(math.log(d)))
			self.strength = self.strength < 4 and self.strength + 1 or 4
			self:setScale(0.5 + self.strength * 0.1)
			self.fperiod = 12 / self.strength
			-- self:setAngleSpeed(self:getAngleSpeed() / 2)
			if soundOn then
				sound('boing'):setPitch(self.strength - 1)
				local newPitch = 1 + 0.1 * self.strength
				if newPitch > timerPitch then
					if soundOn then
						local s = sound('timer0', true);
						-- print('timerO isPlaying:', s:isPlaying())
						_ = s:isPlaying() and s:setPitch(newPitch)
					end
					timerPitch = newPitch
				end
			end
		end
	end
end


function Bomb:explode()
	local volume = self.strength
    -- ignore self outside current level

	if self:getParent() == level.bombLayer then
		explode(self, volume) -- particles
		local x, y = self:getPosition()

		-- activate gui if after last bomb explosion
		-- if ammo == 0 and game.state == state.ingame and game.guiState == state.idle then
			-- setGuiState(state.activated)
		-- end

		-- blow and damage
		for sprite, _ in pairs(Body.getAnimated()) do
			if sprite ~= self and (sprite.windage or sprite.onHit) then
				local xm, ym =  sprite:getX(), sprite:getY()
				local a = (xm > x) and math.atan((ym - y) / (xm - x)) or (xm < x) and math.pi - math.atan((ym - y) / (x - xm)) or ((ym > y)  and (math.pi / 2) or 3 * (math.pi / 2))
				local d = math.sqrt((x - xm) * (x - xm) + (y - ym) * (y - ym))

				if sprite.onHit then
					-- if sprite.life and
					if d > sprite:getHeight() / 4 then d = d - sprite:getHeight() / 4 end
					local hit = (d < 10 + 15 * volume)
					if hit then
						local damage = (18 * volume) * (25 * volume / (25 * volume + d))
						sprite:onHit(damage, d, a)
					end
				end

				if sprite.windage then
					local xs, ys = sprite:getSpeed()
					if sprite.body then
					   sprite.body:applyLinearImpulse(
						0.5 * sprite.windage * (15 * volume / (10 + 0.7 * d)) * math.cos(a),
						0.5 * sprite.windage * (15 * volume / (10 + 0.7 * d)) * math.sin(a),
						sprite:getX(), sprite:getY())
					else
						sprite:setSpeed(xs + sprite.windage * (15 * volume / (10 + 0.4 * d)) * math.cos(a),
									ys + sprite.windage * (15 * volume / (10 + 0.4 * d)) * math.sin(a))
					end
				end	
			end
		end
	end
	self:stop()
end

function Bomb:init(textureOrTextureRegion, level, sleepy)
	local bomb = self
	bomb.shape = b2.CircleShape.new(0, 0, 8)
	-- bomb:setRotation(0)
	bomb:setScale(0.5)
	bomb:setAnchorPoint(0.5,0.55)
	if sleepy then
		bomb:setWorld(level.innerWorld, Body.BALL)
		bomb.strength = 0
	    bomb.timer = (5 + math.random(3)) / 6 * ((level.timer or 4) / timeRate)
		bomb.angleSpeed = 0
	else
		bomb:setWorld(level.innerWorld, Body.BALL, false, {categoryBits = 4, maskBits = 9})
		bomb.strength = 1
		bomb.timer = (level.timer or 4) / timeRate
		bomb:setTtl(bomb.timer)
		bomb.iterate = Bomb.burn
		bomb.angleSpeed = 1
	end
	bomb.gravity = level.bombGravity
	bomb.windage = 1.5
	-- bomb.acceleration = level.friction
	-- bomb.acceleration = level.friction / 2
	bomb.final = Bomb.explode
	-- print('bomb', bomb.timer)
	bomb.gleam = Bitmap.new(bombRegionLight)
	bomb.gleam:setAnchorPoint(0.5, 0.5)
	bomb:addChild(bomb.gleam)
	bomb.ibling = 0
	level.bombLayer:addMovingChild(bomb)
end
