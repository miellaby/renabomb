Zombi = Core.class(BitmapBody)

function Zombi:iterate()
	local x = self:getX()
	-- self should not go outside
	if x < 0 then
		local xs, ys = self:getSpeed()
		xs = (xs > 0 and xs or -xs)
		if self.flip then
			self:setScaleX(1)
			self.flip = false
		end
		self:setSpeed(xs, ys)
	elseif x > stageW then
		local xs, ys = self:getSpeed()
		xs = (xs > 0 and -xs or xs)
		if not self.flip then
			self:setScaleX(-1)
			self.flip = true
		end
		self:setSpeed(xs, ys)
	end
end

function Zombi:onHit(damage, d, a)
	if self.protection or self.state == state.dead or self.state == state.dying then
		return
	end

	self.life = self.life - damage
	if self.life > 0 then
		self:setState(state.suffering)
	else
		self:setState(state.dying)
		_ = self.hat and table.insert(trophies, self.hat.iHat)
		if not achievements.allTrophy and #trophies == hatCount  then
			achievement("All", "trophies!")
			achievements.allTrophies = true
		end
	end
	
	local points = math.floor(damage / 10) * 100
	points = points * (self.hat and 10 or 1)
	score = score + points
	local xm, ym = self:getPosition()
	bill(xm, ym, string.format("%d", points), 0xFFFF00, 1 + damage / 10)
	_ = self.hat and bill(xm, ym - 40, ({"KaP0W!", "CRASH!", "WHAMM!!", "BAM!!"})[math.random(4)], 0xFF00FF, 3 + damage / 10)
end

function Zombi:final()
	self:stop()
	self:setState(state.dead)
end

function Zombi:hatIterate()
	local host = self:getParent()
	local ir = math.floor((Body.iteration - host.i0) / host.fperiod)
	local x, y
	if host.state == state.dying then
		x, y = self:getPosition()
		self:setSpeed(-0.1, -0.5)
		self.angleSpeed = host.flip and 10 or -10
	elseif host.regions == zombiCryingRegions then
		x, y = 4, -26 - (ir % #host.regions)
	elseif host.regions == zombiCryEndingRegions then
		x, y = 4, -30 + (ir % #host.regions)
	elseif host.regions == zombiCryLoopingRegions then
		x, y = 4, -39 - 4 * math.sin(math.pi/6 * (ir % #host.regions))
	else
		x, y = 4,  -23 - 3 * math.sin(math.pi/8 * (ir % #host.regions))
	end
	
	self:setPosition(x, y)
end


function Zombi:setState(s)
	assert(s ~= nil)
	self.state = s
	-- print('poke', s == state.dead and 'dead' or 'not dead')
	waitFor.trigger(self.pokeSignal)
end

function Zombi:live()
	local condFall = function()
		return self:getY() > 1.1 * stageH
	end
	
	while game.running and self.state ~= state.dead do
	
		if self.state == state.standing then
			local r = math.random(3)
			if r == 1 then
				self.flip = (not self.flip)
				self:setScaleX(self.flip and -1 or 1)
				local r = self:getRotation()
				if r > 180 then r = r - 360
				elseif r < -180 then r = r + 360 end
				if r > 45 or r < -45 then
					self.body:applyLinearImpulse(0, -0.5, self:getX(), self:getY())
					self.body:applyAngularImpulse(self:getRotation() > 0 and -0.025 or 0.025)
				end
				if (self.x0 ~= nil) then
					local x = self:getX()
					local xs, ys = self:getSpeed()
					while game.running and
					           (self.flip and x > self.x0 and xs > -2
								or (not self.flip) and x < self.x1 and xs < 2)
							and self.state == state.standing
							and (self.carried or 0) > 0 do
						-- self:setSpeed(self.flip and -4 or 4, ys)
						
						self.body:applyLinearImpulse((self.flip) and -0.8 or 0.8, 0, x, self:getY())
						if self:getY() > 1.1 * stageH then
							self.state = state.dead
						else
							waitFor.signal(self.pokeSignal, 0.1)
						end
						x = self:getX()
						xs, ys = self:getSpeed()
					end
					if self.state == state.standing then
						-- self:setSpeed(xs / 2, ys)
					end
				end
			elseif r == 2 then
				self:setTextureLoop(zombiCryingRegions, 5, function(self, loop)
					if soundOn and (game.state == state.ingame or game.state == state.timeout) then
						local s = sound('monsterDying')
						s:setVolume(0.25)
						s:setPitch(2)
					end -- zombiCryLoopingRegions
					self:setTextureLoop(zombiCryLoopingRegions, 3, function(self, loop)
						if loop > 1 then
							self:setTextureLoop(zombiCryEndingRegions, 5, function(self, loop)
								self:setTextureLoop(zombiStandingRegions, 5)
								self.onLoop = nil
							end)
						end
					end)
				end)
			end

			if self.state == state.standing then
				waitFor.signal(self.pokeSignal, 5, condFall)
				if condFall() and self.state == state.standing then
					self.state = state.dead
				end
			end

		elseif self.state == state.suffering then
			-- print('suffering')
			self.fade = 0.02
			self.i0 = Body.iteration
			self:setColorTransform(5, 0.5 , 0.5, 1)
			if (waitFor.signal(self.pokeSignal, 1) == waitFor.TIMEOUT
				and self.state == state.suffering) then
				self.state = state.standing
				self:setAlpha(1)
				self.fade = nil
				self:setColorTransform(1, 1 , 1, 1)
			end
			
		elseif self.state == state.dying then
			self:stopTextureLoop()
			self:setTextureRegion(zombiCryEndingRegions[2])
			if soundOn and (game.state == state.ingame or game.state == state.timeout) then
				local s = sound('monsterDying')
				s:setVolume(0.5)
				s:setPitch(1)
			end

			self.life = nil
			self:setColorTransform(0.8, 0.8, 5, 1)
			self:setY(self:getY() - self:getHeight() / 3)
			self:setAnchorPoint(0.5,0.5)
			self.angleSpeed = -1
			local xs, ys = self:getSpeed()
			self:setSpeed(xs * 3, ys * 2 - 2)
			self:setWorld(nil)
			self.acceleration = -0.02
			self.fade = -0.005
			self:setTtl(runMode and 50 or 100)
			waitFor.signal(self.pokeSignal)

		else
			assert(not 'ok')
		end
	end
	_ = self.hat and self.hat:freeze()
	self:stop()
	self.parentLevel.zombiCount = self.parentLevel.zombiCount - 1
	-- print('dead, remains', level.zombiCount, "state:", game.state.label);
	_= self.parentLevel == level and level.zombiCount == 0 and waitFor.trigger(waitFor.POKE)
end


function Zombi:init(textureOrTextureRegion, level, x0, x1, y)
	self.parentLevel = level
	self.pokeSignal = {}
	self:setTextureLoop(zombiStandingRegions, 5)
	self:setAnchorPoint(0.5, 0.8)
	local x = (x0 + x1) / 2

	if (x1 - x0 > self:getWidth()) then
		self.x1 = x1 - self:getWidth() / 2
		self.x0 = x0 + self:getWidth() / 2
	end
	

	self:setPosition(x, y)
	self.state = state.standing
	self.life = level.life or (40 + level.i * 10)
	if (self.life > 100) then self.life = 100 end
	self.shape = b2.PolygonShape.new()
	self.shape:setAsBox(9, 9, 0, 0, 0)
	self:setWorld(level.innerWorld, Body.BLOCK, false)
	self.windage = 0.6
	self.density = 0.8
	self.friction = level.friction
	level.zombiLayer:addMovingChild(self)
	level.zombiCount = level.zombiCount + 1
	if level.zombiCount == 1 and level.hat ~= nil then
		self.hat = BitmapBody.new(zombiHatsRegions[level.hat])
		self.hat.iHat = level.hat
		self.hat:setAnchorPoint(0.5, 0.6)
		self.hat:setPosition(5,-23)
		self:addMovingChild(self.hat)
		self.hat.iterate = Zombi.hatIterate
		self.hat.floating = true
	end

		
	local cozombi = coroutine.create(function()
		self:live()
	end);
	-- names[cozombi] = 'zombi.' .. level.i .. '.'  .. x0 .. '.' .. x1 .. '.' .. y
	ok, msg = coroutine.resume(cozombi)
	if (not ok) then error(msg) end
end

