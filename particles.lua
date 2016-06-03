local particles = Shape.new()
stage:addChildAt(particles, 1)
stage.particles = particles

local billI = 1
function bill(x, y, value, color, volume)
	function myFade(self)
		self:setTtl(30, self.stop)
		self.fade = -0.04
	end
	billI = (billI % 3) + 1

	volume = volume == nil and 1 or volume
	local bill = Body.new()
	local txtBill = TextField.new(font1, value)
	bill:addChild(txtBill)
	stage:addMovingChild(bill)
	bill:setPosition(x, y)
	txtBill:setTextColor(color)
	txtBill:setPosition(-txtBill:getWidth() / 2, -txtBill:getHeight() / 2)
	bill:setRotation(-6 + billI * 3)
	bill:setTtl(60 + math.floor(volume * 5), myFade)
	bill.floating = true
	bill:setSpeed(0, -0.3 - volume * 0.01)
	bill.acceleration = -0.022 -0.02 / (10 + volume)
	bill.angleSpeed = -(0.025 + 0.01 * billI) / volume
	bill:setScale(0.3 + 0.1 * volume)
	bill.zoom = bill:getWidth() < stageW * 0.4 and 0.001 + 0.0005 * volume or 0
	--bill.fade = -0.006 - 0.013 / volume
	return bill
end

local starBuffer = {nil, nil, nil, nil, nil, nil, nil, nil, nil, nil}
local starBufferI = 1
function scintille(self)
   self:setScale(0.25 + self.volume / 12 + 0.3 * math.random())
end	
function bling(x, y, xs, ys, volume, fall, where)
	if (volume > 0.5) then
		application:setBackgroundColor(0xFFFFFF)
		stage.boing = stage.boing + volume / 5
	end
	local nstar = volume > 5 and math.floor(0.6 + volume * 0.6) or 1
	local star
	for j = 1, nstar do
		starBufferI = (starBufferI % (lowend > 0 and 3 or 10)) + 1
		local oldStar = starBuffer[starBufferI]
		if oldStar ~= nil then
			star = oldStar
		else
			star = BitmapBody.new(starRegions[1])
			star:setBlendMode(j == 1 and Sprite.SCREEN or Sprite.ADD)
			star:setAnchorPoint(0.5, 0.5)
			star:setTextureLoop(starRegions, 10)
			starBuffer[starBufferI] = star
		end
		(where or particles):addMovingChild(star)
		star.floating = not fall
		star:setAlpha(1)
		star.fade = fall and -0.001 or -0.015
		star.acceleration = fall and -0.001 or -0.01
		
		local angle = math.pi * 2 * math.random()
		local speed = (1 + (volume > 1 and math.random(volume) or 0))
		star.xSpeed = (3 * xs + 2 * math.cos(angle) * speed)  / 5
		star.ySpeed = (3 * ys + 2 * math.sin(angle) * speed)  / 5
		star.angleSpeed = 4 * math.random(5) - 10
		star.volume = volume
		star.iterate = fall and scintille or nil

		local t = 3.14 + starBufferI * 1.55
	
		-- animate r,g,b multipliers of color transform
		local r =  0.3 + (math.sin(t * 0.5 + 0.3) + 1) / 1.3
		local g = (math.sin(t * 0.8 + 0.2) + 1) / 1.5
		local b = (math.sin(t * 1 + 0.6) + 1) / 1.5
	
		-- set color transform
		star:setColorTransform(r, g, b, 1)

		star:setScale(0.25 + volume / 20)
		star.zoom = (volume > 4 and 0.005 or nil) 
		
		star:setPosition(x, y)
		star:setTtl(fall and 600 or (50 + volume * 3))

		if lowend > 0 then break end
	end
	return star
end




local sparkleBuffer = {nil, nil, nil, nil, nil, nil, nil, nil, nil, nil,
                 nil, nil, nil, nil, nil, nil}
local sparkleBufferI = 1
 
function sparkle(x, y, xs, ys, volume)
	sparkleBufferI = (sparkleBufferI % (lowend > 0 and 3 or 16)) + 1
	local sparkle
	local oldSparkle = sparkleBuffer[sparkleBufferI]
    if oldSparkle ~= nil then
		sparkle = oldSparkle
	else
		sparkle = BitmapBody.new(sparkleRegions[math.random(2)])
		sparkle:setAnchorPoint(0.5, 0.5)
		sparkle.acceleration = -0.02
		sparkle.fade = -0.005
		sparkle.angleSpeed = 4 * math.random(15) - 30
		--sparkle.floating = true
		sparkle:setBlendMode((sparkleBufferI % 2 == 1) and Sprite.ADD or Sprite.SCREEN)
	
		sparkleBuffer[sparkleBufferI] = sparkle
 	end
	particles:addMovingChild(sparkle)
	
	sparkle:setAlpha(0.9)
	
	local angle = math.pi * 2 * math.random()
	sparkle.xSpeed = (3 * xs + 2 * math.cos(angle)) * (1 + (volume > 1 and math.random(volume) or 0)) / 5
	sparkle.ySpeed = (3 * ys + 2 * math.sin(angle)) * (1 + (volume > 1 and math.random(volume) or 0)) / 5
	
	sparkle:setScale(0.25 + volume / 12, 0.25 + volume / 12)
	sparkle.zoom = (volume > 4 and -0.01 or nil) 
	
	sparkle:setPosition(x, y)
	sparkle:setTtl(lowend > 0 and 10 or 40)
	
end


local dustBuffer = {nil, nil, nil, nil, nil, nil, nil, nil}
local dustBufferI = 1
local dustTextureRegion = nil
function dust()
	dustBufferI = (dustBufferI % (lowend > 0 and 3 or 8)) + 1
	if dustTextureRegion == nil or dustTextureRegion.i ~= level.i then
		local textureGround = groundTextures[1 + (level.i - 1) % #groundTextures]
		local width, height = 10, 5
	    dustTextureRegion = TextureRegion.new(textureGround, 32, 32, 10, 5)
		dustTextureRegion.i = level.i
	end
	
	local oldDust = dustBuffer[dustBufferI]
	local dust
	local x, y = math.random(stageW) / 2 + stageW / 4, -math.random(stageH) / 4
	
    if oldDust ~= nil then
		dust = oldDust
		dust:setTextureRegion(dustTextureRegion);
	else
		dust = BitmapBody.new(dustTextureRegion); -- Sprite.new()
		dust:setAnchorPoint(0.5, 0.5)
		dust.floating = false
		dust.zoom = -0.008
		dust.acceleration = 0.001
		dust:setColorTransform(0.75, 0.75, 0.75, 1)
		dust.angleSpeed = 4 * math.random(15) - 30
		dustBuffer[dustBufferI] = dust
 	end
	particles:addMovingChild(dust)
	
	dust:setScale(1.2 + (10 + math.random(10)) / 40, 1.2 + (10 + math.random(10)) / 40)
	dust:setSpeed(math.random(3) / 2 - 0.6, 4 + math.random(6) / 2)
	dust:setPosition(x, y)

	dust:setTtl(100)	
end


local smokeBuffer = {nil, nil, nil, nil, nil, nil, nil, nil, nil, nil}
local smokeBufferI = 1
local iSlot = 1

local explosionBuffer = {nil, nil, nil, nil}
local explosionBufferI = 1

function explode(self, volume)
    local explodable = self

	local x, y = explodable:getX(), explodable:getY()

	iSlot = iSlot == 1 and 0 or 1
	if soundOn then
		sound('dring', true):setPaused(true)
		sound(iSlot == 1 and 'explo2' or 'explo1')
	end
	

	application:setBackgroundColor(0xFF0000)

	stage.boing = stage.boing + 20

	if (game.state == state.ingame and rena.regions == standingRegions and math.abs(x - rena:getX()) + math.abs(y - rena:getY()) < 100) then
		rena:setTextureLoop(blockingRegions, 15)
		rena:setAnchorPoint(0.5, 0.66)
		function rena:iterate()
			if self.regions ~= blockingRegions or self.loop > 3 then
				self.iterate = nil
				self:setTextureLoop(standingRegions, 5)
			end
		end
	end
	
	for j = 0,volume do
		smokeBufferI = (smokeBufferI % (lowend > 0 and 3 or 10)) + 1
		local oldSmoke = smokeBuffer[smokeBufferI]
		local smoke 
		if oldSmoke ~= nil then
			smoke = oldSmoke
		else
			smoke = BitmapBody.new(smokeRegions[1])
			smoke:setTextureLoop(smokeRegions, 4)
			smoke.floating = true
			smoke:setBlendMode(smokeBufferI % 2 == 0 and Sprite.SCREEN or Sprite.MULTIPLY)
			smoke:setAnchorPoint(0.5,0.5)
			smoke.acceleration = -0.02

			smokeBuffer[smokeBufferI] = smoke
		end
		particles:addMovingChild(smoke)
 	
		smoke:setAlpha(0.8)
		smoke.fade = -0.02 / (1 + math.random(volume))
		smoke:setScale(0.75 + volume / 4, 0.75 + volume / 4)
		local angle = math.pi * 2 * math.random()
		local speed = (1 + math.random(volume or 1)) * 7
		smoke.xSpeed = math.cos(angle) * speed
		smoke.ySpeed = math.sin(angle) * speed
		-- smoke.angleSpeed = 3 * volume
		smoke:setPosition(x, y)
		smoke:setTtl(50)
		if lowend > 0 then break end
	end
	
	explosionBufferI = (explosionBufferI % (lowend > 0 and 1 or 4)) + 1
	local oldExplosion = explosionBuffer[explosionBufferI]
	local explosion 
	if oldExplosion ~= nil then
		explosion = oldExplosion
	else
		explosion = BitmapBody.new(explosionRegions[1])
		explosion:setTextureLoop(explosionRegions, 6)
		explosion.floating = true
		explosion:setBlendMode(Sprite.ADD)
		explosion:setAnchorPoint(0.5,0.5)
		explosion.angleSpeed = 10
		explosion.zoom = 0.01 + volume * 0.01; -- -0.01
		explosion.fade = -0.03

		explosionBuffer[explosionBufferI] = explosion
	end
	particles:addMovingChild(explosion)
 	
	explosion:setScale(volume / 3, volume / 3)
	explosion:setAlpha(0.8)
	explosion:setPosition(x, y)
	explosion:setTtl(25)
	
end
