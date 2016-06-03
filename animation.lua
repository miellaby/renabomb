require "box2d"
Body = Core.class(Sprite)
BitmapBody = Core.class(Bitmap)
function Body:init()
	self.animations = {}
end
function BitmapBody:init()
	self.animations = {}
end

Body.worlds = {}
Body.iteration = 0
Body.movings = {}
Body.movingCount = 0
Body.toBeRemoved = {}
Body.toBeAdded = {}

-- shapeTypes for phy. bodies
Body.BALL = {}
Body.BLOCK = {}

timeRate = 1.0/60.0
-- print("timeRate", timeRate)

-- when 2 physical bodies collide
local function onBeginContact(world, event)
	local fixtureA = event.fixtureA
	local fixtureB = event.fixtureB
	local bodyA = fixtureA:getBody()
	local bodyB = fixtureB:getBody()
	-- local y = event.contact:getManifold().localPoint.y
	local obs = world.obstacles[bodyA] or world.obstacles[bodyB]; 
	local sprite = world.bodies[bodyA] or world.bodies[bodyB];
	if obs and sprite then -- contact between a sprite and a platform
		sprite.carried = (sprite.carried or 0) + 1 -- platforms counter goes up
		sprite.carrier = obs -- one platform (if several platforms in contact, it will be a random one of them)
		-- the restitution is hardwired to a property of the platform
		event.contact:setRestitution(obs.restitution or 0.6)
		-- print(sprite.life, sprite.carried)
	end
end

-- when 2 physical bodies don't collide any more
local function onEndContact(world, event)
	-- get the fixtures and bodies
	local fixtureA = event.fixtureA
	local fixtureB = event.fixtureB
	local bodyA = fixtureA:getBody()
	local bodyB = fixtureB:getBody()
	local obs = world.obstacles[bodyA] or world.obstacles[bodyB]; 
	local sprite = world.bodies[bodyA] or world.bodies[bodyB];
	-- local y = event.contact:getManifold().localPoint.y
	if obs and sprite then -- contact loss between a sprite and a platform
		sprite.carried = sprite.carried - 1 -- platforms counter goes down
		sprite.carrier = nil
	end
	
	if obs and sprite and sprite.onBounce then
		sprite:onBounce()
	end
end

Body.clearWorld = function(world)
	for body, obstacle in pairs(world.obstacles) do
		world:destroyBody(body)
		obstacle.body = nil
		obstacle.world = nil
	end
	for body, sprite in pairs(world.bodies) do
		world:destroyBody(body)
		sprite.body = nil
		sprite.world = nil
	end
	world.obstacles = {}
	world.bodies = {}
	Body.worlds[world] = nil
end

Body.createWorld = function(name)
	-- print('create world', name)
	local world = b2.World.new(0, 3, true) -- gravityx gravityy doSleep
	world.name = name
	world.obstacles = {}
	world.bodies = {}
	world.clear = Body.clearWorld
	Body.worlds[world] = true

	-- register 2 physics events with the world object
	world:addEventListener(Event.BEGIN_CONTACT, function(event)
		onBeginContact(world, event)
	end)
	world:addEventListener(Event.END_CONTACT, function(event)
		onEndContact(world, event)
	end)
	return world
end
BitmapBody.createWorld = Body.createWorld

-- default world (equivalent to the default stage)
Body.stage = Body.createWorld('stage') -- gravityx gravityy doSleep

-- called by Body:setWorld for platforms and the like
function Body:_rigidify()
	local shapeType = self.shapeType
	local world = self.world
	local body = world:createBody{type = b2.STATIC_BODY}
	local x, y = self:getX(), self:getY()
	local w, h = self:getWidth(), self:getHeight();
	self.body = body
	self.rigid = true
	world.obstacles[body] = self
	body:setPosition(x, y)
	body:setAngle(self:getRotation() * math.pi / 180)
	-- print(world.name, 'rigidify', x, y, w, h, self.restitution);
	local fixture = body:createFixture{shape = self.shape,
		density = 1,
		friction = self.friction or 0.9,
		restitution = self.restitution or 0.2,
		linearDamping = self.linearDamping,
		angularDamping = self.angularDamping or 3,
		filter = self.filter}
end
BitmapBody._rigidify = Body._rigidify

-- called by Body:setWorld for moving physical prites
function Body:_bodify()
	local shapeType = self.shapeType
	local world = self.world
	local body = world:createBody{type = b2.DYNAMIC_BODY}
	local x, y = self:getX(), self:getY()
	local w, h = self:getWidth(), self:getHeight();
	self.body = body
	self.rigid = false
	world.bodies[self.body] = self

	-- print('body', x, y, self:getRotation(), w, h)

	--body:applyLinearImpulse(self.xSpeed * 6, self.ySpeed * 6, self:getX(), self:getY())

	local density = 1.0
	local friction = 0.4
	_ = self.shape and body:createFixture{
		shape = self.shape,
	 	density = self.density or 1.0,
		friction = self.friction or 0.4,
		restitution = self.restitution or 0.75,
		linearDamping = self.linearDamping,
		angularDamping = self.angularDamping or 1,
		filter = self.filter}

	body:setPosition(x, y)
	body:setAngle(self:getRotation() * math.pi / 180)
	_ = self.ySpeed ~= nil and body:setLinearVelocity(self.xSpeed, self.ySpeed)

	if  self.floating then
		local gx, gy = world:getGravity()
		local mass = body:getMass()
		body:applyForce(-mass * gx, -mass * gy, x, y);
	end
	
end
BitmapBody._bodify = Body._bodify

-- called by setWorld to create a single shape for the phy body
function Body:setShape()
	if self.shape then return end
	local shapeType = self.shapeType

	if shapeType ~= Body.BALL then
		local w, h = self:getWidth(), self:getHeight();
		self.shape = b2.PolygonShape.new()
		self.shape:setAsBox(w / 2 - (self.bodyWidthPadding or 0), h / 2 - (self.bodyHeightPadding or 0))
	else
		local radius = self:getWidth() / 2
		self.shape = b2.CircleShape.new(0, 0, radius)
	end
end
BitmapBody.setShape = Body.setShape

-- add self to a phy. world and pair self with a phy. body if moving
function Body:setWorld(world, shapeType, rigid, filter)
	if self.body and self.world ~= world then
	    -- world substitution or nihiling
		local world = self.world and self.world
		world.obstacles[self.body] = nil
		world.bodies[self.body] = nil
		world:destroyBody(self.body)
		self.body = nil
	end
	self.shapeType = shapeType
	self.world = world
	self.rigid = rigid or false
	self.filter = filter or (rigid and {categoryBits = 1, maskBits = 14} or {categoryBits = 2, maskBits = 15})
	-- if already moving
	if self.moving and world ~= nil and self.body == nil then
		-- create a phy shape
		self:setShape()
		-- create a phy. body
		if self.rigid then
			self:_rigidify()
		else
			self:_bodify()
		end
	end
end
BitmapBody.setWorld = Body.setWorld

-- set position of both self and self.body
Body._setPosition = Sprite.setPosition
function Body:setPosition(x, y)
	Sprite.setPosition(self, x, y)
	_ = self.body and self.body:setPosition(x, y)
end
BitmapBody._setPosition = Bitmap.setPosition
function BitmapBody:setPosition(x, y)
	Bitmap.setPosition(self, x, y)
	_ = self.body and self.body:setPosition(x, y)
end

-- set rotation of both self and self.body
Body._setRotation = Sprite.setRotation
function Body:setRotation(a)
	Sprite.setRotation(self, a)
	_ = self.body and self.body:setAngle(a * math.pi / 180)
end
BitmapBody._setRotation = Bitmap.setRotation
function BitmapBody:setRotation(a)
	Sprite.setRotation(self, a)
	_ = self.body and self.body:setAngle(a * math.pi / 180)
end

-- set speed of both self and self.body
function Body:setSpeed(sx, sy)
	self.xSpeed = sx
	self.ySpeed = sy
	
	if self.body then
		self.body:setLinearVelocity(sx, sy)
	end
end
BitmapBody.setSpeed = Body.setSpeed

function Body:getSpeed()
	if self.ySpeed ~= nil then
		return self.xSpeed, self.ySpeed
	else
		return 0, 0
	end
end
BitmapBody.getSpeed = Body.getSpeed

-- set rotation speed of both self and self.body
function Body:setAngleSpeed(s)
	self.angleSpeed = s
	
	if self.body then
		self.body:setAngularVelocity(s)
	end
end
BitmapBody.setAngleSpeed = Body.setAngleSpeed

function Body:getAngleSpeed()
	if self.angleSpeed ~= nil then
		return self.angleSpeed
	else
		return 0, 0
	end
end
BitmapBody.getAngleSpeed = Body.getAngleSpeed

-- make a non-moving sprite moves again
function Body:resume()
	-- i0 counts iterations from the beginning of a move
	self.i0 = Body.iteration
	
	-- set a null speed if no defined speed yet
	if self.ySpeed == nil then
		self.xSpeed = 0
		self.ySpeed = 0
	end

	if self.moving == nil then -- if not moving already
	
		-- global counter of moving things
		Body.movingCount = Body.movingCount + 1
		
		-- for some reasons, one can't make something move immediatly. That's life
		-- assert(Body.movings[self] == nil) : no because clearRemoved
		self.moving = true
		table.insert(Body.toBeAdded, self)
	end
end
BitmapBody.resume = Body.resume

-- stop self animation/simulation (generaly before stage removal)
function Body:freeze(recursive)
	if not self.moving then
		return
	end
	-- print('freeze', self.name or self)
	-- assert(Body.movings[self] ~= nil) : no because toBeAdded
	Body.movingCount = Body.movingCount - 1

	self.moving = nil
	
	-- actually, one doesn't immediatly remove the sprite
	table.insert(Body.toBeRemoved, self)

	if recursive then
		local i
		for i= 1, self:getChildrenNum() do
			local c = self:getChildAt(i)
			_ = c.freeze and c:freeze(recursive)				
		end
	end
end
BitmapBody.freeze = Body.freeze

-- stop == freeze + removeFromParent
function Body:stop(recursive)
	self:freeze(recursive)
	self:removeFromParent()
	self.ttl = nil
	self.t0 = nil
	self.animations = {} -- reset animations
end
BitmapBody.stop = Body.stop

-- set a "time to live". Start a timer up to self:stop() or an alternative "final".
function Body:setTtl(ttl, final)
	self.t0 = Body.iteration
	self.ttl = ttl
	if final ~= nil then self.final = final end
end
BitmapBody.setTtl = Body.setTtl

-- revert self:setTextureLoop
function Body:stopTextureLoop()
	self.regions = nil
	self.onLoop = nil
end
BitmapBody.stopTextureLoop = Body.stopTextureLoop

-- make self rotating between pictures in a table (regions)
function Body:setTextureLoop(regions, fperiod, onLoop)
	assert(regions)
	self.i0 = Body.iteration
	self.loop = 0
	self.regions = regions
	if regions ~= nil then
		self.fperiod = fperiod or self.fperiod or 5
		-- self:setTextureRegion(regions[1])
	end
	self.onLoop = onLoop
end
BitmapBody.setTextureLoop = Body.setTextureLoop

-- animation set by self:setFading call
local fadeIterator = function(self)
	-- print('i', self:getAlpha(), self.name, from, to, step)
	if (self.fade > 0) and (self:getAlpha() >= self.toAlpha) or (self.fade < 0) and (self:getAlpha() <= self.toAlpha) then
		-- print('stop')
		self:setAlpha(self.toAlpha)
		self.fade = 0
		self.animations.fading = nil
		_= self.after and self.after(self)
	end
end

-- sets up a fading animation by setting self.animations.fading = fadeIterator
function Body:setFading(to, from, step, cb)
	from = (from == nil) and self:getAlpha() or from or 0
	step = (step == nil) and ((to - from) / 50) or step or 0.01
	if math.abs(step) < 0.00001 then
		self.fade = 0
	    self:setAlpha(to)
		_= cb and cb(self)
	else
		self:setAlpha(from)
		self.toAlpha = to
		self.fade = step
		self.after = cb
		self.animations.fading = fadeIterator
	end
end
BitmapBody.setFading = Body.setFading

-- all animated things
function Body.getAnimated()
	return Body.movings
end

-- between two consecutive frames, processes the cumulative lists of removed/added animated sprites
function Body._processRemovedAdded()
	for _, child in ipairs(Body.toBeRemoved) do
		if not child.moving then
			Body.movings[child] = nil
			if child.body then
				if child.rigid then
					child.world.obstacles[child.body] = nil
				else
					child.world.bodies[child.body] = nil
				end
				child.world:destroyBody(child.body)
				-- child.world = nil : no one keeps the fact that the sprite belongs to a phy world
				child.body = nil
			end
		end
	end
	Body.toBeRemoved = {}

	-- turn freezed/new sprites into moving ones
	for _, child in ipairs(Body.toBeAdded) do
		if child.moving then
			Body.movings[child] = child
			if child.world and child.shapeType and not child.body then
				child:setShape()
				if child.rigid then
					child:_rigidify()
				else
					child:_bodify()
				end
			end
		end
	end
	Body.toBeAdded = {}

end

-- to be called at every frame
function Body.animate()
	Body._processRemovedAdded()
	-- print('iteration', Body.iteration, 'animating', 'sprites');
	
	-- Body.world:step(timeRate, 8, 3) --
	for world, _ in pairs(Body.worlds) do
		--local c = 0
		--for _, _ in pairs(world.obstacles) do
		-- c = c + 1
		--end
		--print(name, 'animate', c, 'obstacles')
		--c = 0
		--for _, _ in pairs(world.bodies) do
		-- c = c + 1
		--end
		-- print(name, 'animate', c, 'bodies')
		world:step(timeRate, 8, 10)
	end
	
    local i = Body.iteration
	Body.iteration = i + 1
	-- if i % 120 == 0 then
	--	-- print('%120')
	-- end
	-- print('ding')
	for child, _ in pairs(Body.movings) do
		if child.moving then
			-- detect anomalies
			-- if  child:getParent() ~= stage and not child:getParent():getParent() then
			--    print('lost ', child.name or child)
			--	child:freeze()
			-- end
			
			-- there is two kinds of animated thingies
			-- if thing.body and ~thing.rigid ==> the body is linked to a physical body which may move
			-- if ~thing.body ==> the body is simply animated based on speed/acceleration/iterate
			if child.body then -- the body is linked to a physical body
				-- print(child.body:getPosition())
				local x, y = child.body:getPosition()
				if not child.rigid then
					child.xSpeed, child.ySpeed = child.body:getLinearVelocity()
					child.angleSpeed = child.body:getAngularVelocity()
					child:_setPosition(x, y)
					local rot = child.body:getAngle() * 180 / math.pi
					child:_setRotation(rot)
					
					
					if child.gleam then -- a "gleam" is a special child one doesn't want to rotate
						child.gleam:setRotation(-rot)
					end
					
					-- to make thing flying, one needs to apply an anti-gravity force
					if child.floating then
						local gx, gy = child.world:getGravity()
						local mass = child.body:getMass()
						child.body:applyForce(-mass * gx, -mass * gy, x, y);
					end
				end
			elseif child.world == nil then
				-- non-physical things are animated "by hand"
				
				-- speed
				if child.ySpeed ~= nil then
					local x,y = child:getPosition()
					x = x + child.xSpeed
					y = y + child.ySpeed
					child:setPosition(x, y)
				end
				
				-- rotation speed
				if child.angleSpeed ~= nil then
					local angle = child:getRotation() + child.angleSpeed
					child:setRotation(angle)
					
					-- a gleam is a special not rotated sub-child
					if (child.gleam) then
						child.gleam:setRotation(-angle)
					end
				end
				
				-- gravity for non-flying object
				if not child.floating then
					child.ySpeed = child.ySpeed + (child.gravity == nil and stage.gravity or child.gravity)
				end
							
				-- acceleration (or slowing)
				if child.acceleration ~= nil then
					child.xSpeed = child.xSpeed * (1 + child.acceleration + child.xSpeed * child.xSpeed * child.acceleration / 8)
					child.ySpeed = child.ySpeed * (1 + child.acceleration + child.ySpeed * child.ySpeed * child.acceleration / 8)

					-- acceleration changes rotation speed as well
					if child.angleSpeed ~= nil then
						child.angleSpeed = child.angleSpeed * (1 + child.acceleration)
					end
				end
			end
			
			-- manage texture loop
			if child.regions then
				local ii = (i - child.i0) % child.fperiod
				local ir = 1 + math.floor((i - child.i0) / child.fperiod) % #child.regions
				_ = ii == 0 and child:setTextureRegion(child.regions[ir])
				if ir == #child.regions and ii == child.fperiod - 1 then
					child.loop = child.loop + 1
					_ = child.onLoop and child:onLoop(child.loop)
				end
			end

			-- manage "zoom" (scale speed)
			if child.zoom ~= nil then
				local sx, sy = child:getScale()
				local szx, szy = sx + child.zoom, sy + child.zoom
				
				-- child:setScale(sx * (1 + child.zoom), sy * (1 + child.zoom))
				child:setScale(szx > 0 and szx or 0, szy > 0 and szy or 0)
			end
			
			-- manage "fade" (opacity speed)
			if child.fade ~= nil then
				local o = child:getAlpha()
				o = o + child.fade
				o = o > 1 and 1 or o > 0 and o or 0
				child:setAlpha(o)
			end

			-- function based animation
			if child.iterate then
			    -- print('iterate ', child.name or child)
				child:iterate()
			end
			for animationName, animation in pairs(child.animations) do
				animation(child)
			end
			
			-- "time to live"
			if (child.ttl ~= nil and (i - child.t0) > child.ttl) then
				child.ttl = nil
				child.t0 = nil
				if (child.final ~= nil) then
					child:final()
				else
					child:stop()
				end
			end
		end
	end
end

-- addChild + resume
function Sprite:addMovingChild(child)
	self:addChild(child)
	child:resume()
end

-- removeChild + freeze
function Sprite:removeMovingChild(child)
	if child:getParent() == self then
		self:removeChild(child)
	end
	child:freeze()
end
