Boss = Core.class(BitmapBody)

function Boss:iterate()
end

function Boss:final()
	self:stop()
	self:setState(state.dead)
end

function Boss:setState(s)
	assert(s ~= nil)
	self.state = s
	-- print('poke', s == state.dead and 'dead' or 'not dead')
	waitFor.trigger(self.pokeSignal)
end

Boss.onHit = Zombi.onHit

function Boss:onCryBeginLoop(loop)
	if soundOn and game.state == state.ingame then
		local s = sound('monsterDying')
		s:setVolume(1)
		s:setPitch(0.33)
	end -- zombiCryLoopingRegions
	--self:setWorld(nil)
	--self:setWorld(self.parentLevel.innerWorld, Body.BLOCK, false, {categoryBits = 4, maskBits = 9})
	self:setTextureLoop(zombiCryLoopingRegions, nil, Boss.onCryingLoop)
end

function Boss:onCryingLoop(loop)

	if loop > 0 then
		--self:setWorld(nil)
		--self:setWorld(self.parentLevel.innerWorld, Body.BLOCK, false, {categoryBits = 4, maskBits = 13})
	
		self:setTextureLoop(zombiCryEndingRegions, nil, Boss.onCryEndLoop)
		if self.parentLevel.zombiCount < 15 then
			local x = self:getX() + (self.flip and -30 or 30)
			local z = Zombi.new(zombiStandingRegions[1], self.parentLevel, x, x, self:getY() + 26)
			z:setAlpha(0.1)
			z.fade = 0.03
			z:setSpeed((math.random(3) + 3) * (self.flip and -1 or 1), math.random(2))
		end
	end
end

function Boss:onCryEndLoop(loop)
	self:setTextureLoop(zombiStandingRegions)
	self.protection = true
	self.onLoop = nil
	sound('monsterDying', true):stop()
end

function Boss:live()
	local condFall = function()
		return self:getY() > 1.1 * stageH
	end

	while game.running and self.state ~= state.dead do
	
		if self.state == state.standing then
			local r = math.random(4)
			-- print('boss hasard', r)
			if r == 1 and self.protection then
				self.flip = (not self.flip)
				self:setScaleX(self.flip and -3 or 3)
			elseif r == 3 and self.protection then
				if self.parentLevel.zombiCount < 10 then
					self.protection = false
					self:setTextureLoop(zombiCryingRegions, nil, Boss.onCryBeginLoop)
					waitFor.signal(self.pokeSignal, 0.5)
				end
			end

			if self.state == state.standing then
				waitFor.signal(self.pokeSignal, 0.5, condFall)
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
				self:setColorTransform(0.5, 1.1, 0.5, 1)
				if self.life < 300 then
					self.fperiod = self.life < 100 and 3 or 5
				end
			end
			
		elseif self.state == state.dying then
			self:stopTextureLoop()
			self:setTextureRegion(zombiCryEndingRegions[2])
			if soundOn and game.state == state.ingame then
				local s = sound('monsterDying')
				s:setVolume(1)
				s:setPitch(0.8)
			end

			self.life = nil
			self:setColorTransform(0.8, 0.8, 5, 1)
			self:setY(self:getY() - self:getHeight() / 3)
			self:setAnchorPoint(0.5,0.5)
			self.angleSpeed = -1
			self:setSpeed(0, -2)
			self:setWorld(nil)
			self.acceleration = -0.02
			self.fade = -0.003
			self:setTtl(300)
			waitFor.signal(self.pokeSignal)

		else
			assert(not 'ok')
		end
	end
	self:stop()
	self.parentLevel.zombiCount = self.parentLevel.zombiCount - 1
	_= self.parentLevel == level and level.zombiCount == 0 and waitFor.trigger(waitFor.POKE)
end


function Boss:init(textureOrTextureRegion, level, x, y)
	self.parentLevel = level
	self.pokeSignal = {}
	self:setTextureLoop(zombiStandingRegions)
	self:setColorTransform(0.5, 1.1, 0.5, 1)
	self:setAnchorPoint(0.5, 0.486)
	self.protection = true
	self.fperiod = 8
	self:setScale(3)

	self:setPosition(x, y)
	self.state = state.standing
	self.life = runMode and 200 or 500
	--self.mouthOpenRight = b2.PolygonShape.new()
	--self.mouthOpenLeft = b2.PolygonShape.new()
	self:setWorld(level.innerWorld, Body.BLOCK, false, {categoryBits = 4, maskBits = 13})

	self.windage = 0.1
	self.density = 0.8
	self.friction = level.friction
	level.zombiLayer:addChild(self)
	self:resume()
	level.zombiCount = level.zombiCount + 1
		
	local coBoss = coroutine.create(function()
		self:live()
	end);
	-- names[coBoss] = 'Boss.' .. level.i .. '.' .. x .. '.' .. y
	ok, msg = coroutine.resume(coBoss)
	if (not ok) then error(msg) end
end

