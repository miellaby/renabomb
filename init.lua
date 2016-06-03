require("bit")
local i

stageW = 320
stageH = 480
application:setLogicalDimensions(stageW, stageH)


-- frame
frame = Sprite.new()
frame:addChild(Bitmap.new(Texture.new("frame.png", false, {format = TextureBase.RGBA4444})))
local pixel;
-- pixel = Pixel.new(0x7b5b70,2000,4000);
pixel = Shape.new()
pixel:setFillStyle(Shape.SOLID, 0x775577, 1)
pixel:beginPath();pixel:moveTo(0,0);pixel:lineTo(2000, 0);pixel:lineTo(2000, 4000);pixel:lineTo(0, 4000);pixel:lineTo(0, 0);pixel:endPath();
pixel:setPosition(-2000,-1000);
frame:addChild(pixel)
-- pixel = Pixel.new(0x7b5b70,2000,4000);
pixel = Shape.new()
pixel:setFillStyle(Shape.SOLID, 0x775577, 1)
pixel:beginPath();pixel:moveTo(0,0);pixel:lineTo(2000, 0);pixel:lineTo(2000, 4000);pixel:lineTo(0, 4000);pixel:lineTo(0, 0);pixel:endPath();
pixel:setPosition(400,-1000)
frame:addChild(pixel)
-- pixel = Pixel.new(0x7b5b70,4000,2000);
pixel = Shape.new()
pixel:setFillStyle(Shape.SOLID, 0x775577, 1)
pixel:beginPath();pixel:moveTo(0,0);pixel:lineTo(4000, 0);pixel:lineTo(4000, 2000);pixel:lineTo(0, 2000);pixel:lineTo(0, 0);pixel:endPath();
pixel:setPosition(-2000,-2000)
frame:addChild(pixel)
-- pixel = Pixel.new(0x7b5b70,4000,2000);
pixel = Shape.new()
pixel:setFillStyle(Shape.SOLID, 0x775577, 1)
pixel:beginPath();pixel:moveTo(0,0);pixel:lineTo(4000, 0);pixel:lineTo(4000, 2000);pixel:lineTo(0, 2000);pixel:lineTo(0, 0);pixel:endPath();
pixel:setPosition(-2000,600)
frame:addChild(pixel)
--
stage:addChild(frame)
frame:setPosition(-40, -60)

-- top gui
gui = Sprite.new()
stage:addChild(gui)

-- score and the like
ammo, score, rh, scoreCounter, record, runModeRecord, lastScore, maxLevel = 0, 0, 0, 0, 0, 0, 0, 1
lowend, remainingTime, prolongation, lastRemainingTime, retryCounter, totalRetry = 0, 0, 0, 0, 0, 0
runMode = false
trophies, lastTrophies = {}, {}
achievements, lastAchievements = {}, {}
level = nil



-- fonts
font1 = Font.new("MilkCocoa-21.txt", "MilkCocoa-21.png")

-- textures
textureMacaron = Texture.new("macaron.png", false, {format = TextureBase.RGBA5551})
textureOptions = Texture.new("options.png", false, {format = TextureBase.RGBA4444})
textureInventory= Texture.new("inventory.png", false, {format = TextureBase.RGBA5551})
textureSchoolbag= Texture.new("schoolbag.png", false, {format = TextureBase.RGBA5551})
school0 = Texture.new("school0.png", false, {format = TextureBase.RGBA5551})
school1 = Texture.new("school1.png", false,  {format = TextureBase.RGBA5551})
school2 = Texture.new("school2.png", false, {format = TextureBase.RGBA5551})
school3 = Texture.new("school3.png", false, {format = TextureBase.RGBA5551})
school4 = Texture.new("school4.png", false, {format = TextureBase.RGBA5551})
textureListGui = Texture.new("listGui.png", false, {format = TextureBase.RGBA4444})
textureFrom = Texture.new("from.png", false, {format = TextureBase.RGBA4444})
textureBar = Texture.new("bar.png", false, {format = TextureBase.RGBA4444})
textureArrow = Texture.new("arrow.png", false, {format = TextureBase.RGBA4444})
textureBomb = Texture.new("bomb.png", false, {format = TextureBase.RGBA4444})
textureZombi = Texture.new("zombi.png", false, {format = TextureBase.RGBA5551})
textureZombi2 = Texture.new("zombi2.png", false, {format = TextureBase.RGBA5551})
textureZombiHats = Texture.new("hats.png", false, {format = TextureBase.RGBA5551})
textureRena = Texture.new("rena.png", false, {format = TextureBase.RGBA5551})
textureDoor = Texture.new("door.png", false, {format = TextureBase.RGBA5551})
textureBoom = Texture.new("explosion.png", false, {format = TextureBase.RGBA5551})
textureSmoke = Texture.new("smoke.png", false, {format = TextureBase.RGBA5551})
textureExplosion = Texture.new("explosion.png", false, {format = TextureBase.RGBA5551})
textureStar = Texture.new("star.png", false, {format = TextureBase.RGBA5551})
textureTrophy = Texture.new("trophy.png", false, {format = TextureBase.RGBA5551})

textureDirt = Texture.new("dirtf.png", false, {format = TextureBase.RGBA5551})
textureStones = Texture.new("stones.png", false, {format = TextureBase.RGBA5551})
textureRock = Texture.new("rock.png", false, {format = TextureBase.RGBA5551})
textureScales = Texture.new("scales.png", false, {format = TextureBase.RGBA5551})

textureLeafs = Texture.new("leafs.png", false, {format = TextureBase.RGBA5551})
textureButton = Texture.new("button.png", false, {format = TextureBase.RGBA5551})
textureButton0 = Texture.new("button0.png", false, {format = TextureBase.RGBA5551})
textureRecycle = Texture.new("recycle.png", false, {format = TextureBase.RGBA4444})
textureList = Texture.new("liste.png", false, {format = TextureBase.RGBA4444})
textureCaption = Texture.new("caption.png", false, {format = TextureBase.RGBA4444})
textureExit = Texture.new("exit.png", false, {format = TextureBase.RGBA4444})
textureContinue = Texture.new("continue.png", false, {format = TextureBase.RGBA4444})
textureMask =  Texture.new("mask.png", false, {format = TextureBase.RGBA5551})

-- regions
-- TODO: Could use a texture pack

standingRegions = {}
for i = 0, 13 do
    table.insert(standingRegions,
		TextureRegion.new(textureRena, i * 48, 0, 48, 48))
end
crouchingRegions = {}
for i = 0, 1 do
    table.insert(crouchingRegions,
		TextureRegion.new(textureRena, i * 48, 48, 48, 48))
end
 table.insert(crouchingRegions,
		TextureRegion.new(textureRena, 576, 48 * 3, 48, 48))
		
blockingRegions = {}
for i = 0, 1 do
    table.insert(blockingRegions,
		TextureRegion.new(textureRena, (15 + i) * 48, 0, 48, 48))
end

targetingRegions = {}
for i = 0, 1 do
    table.insert(targetingRegions,
		TextureRegion.new(textureRena, 480 + i * 48, 48 * 3, 48, 48))
end

throwingRegions = {}
table.insert(throwingRegions,
		TextureRegion.new(textureRena, 480 + 192, 48 * 3, 48, 48))
table.insert(throwingRegions,
		TextureRegion.new(textureRena, 480 + 192 + 48, 48 * 3, 48, 48))
for i = 2, 9 do
    table.insert(throwingRegions,
		TextureRegion.new(textureRena, 96 + i * 48, 48, 48, 48))
end
table.insert(throwingRegions,
	TextureRegion.new(textureRena, 96 + 9 * 48, 48, 48, 48))

endJumpingRegions = {}
table.insert(endJumpingRegions,
		TextureRegion.new(textureRena, 480 + 192 + 48, 48 * 3, 48, 48))

runningRegions = {}
for i = 0, 7 do
    table.insert(runningRegions,
		TextureRegion.new(textureRena, 0 + i * 48, 100, 50, 35))
end

zombiStandingRegions = {}
for i = 0, 7 do
	table.insert(zombiStandingRegions,
		TextureRegion.new(textureZombi, i * 104, 0, 92, 60))
end

zombiCryingRegions = {}
for i = 0, 2 do
	table.insert(zombiCryingRegions,
		TextureRegion.new(textureZombi2, 4 + i * 104, 14, 92, 60))
end

zombiCryLoopingRegions = {}
for i = 0, 1 do
	table.insert(zombiCryLoopingRegions,
		TextureRegion.new(textureZombi2, 5 + (3 + i) * 104, 14, 94, 60))
end
for i = 2, 7 do
	table.insert(zombiCryLoopingRegions,
		TextureRegion.new(textureZombi2, 5 + (i - 2) * 104, 94 + 14, 94, 60))
end

zombiHatsRegions = {}
for i = 1, textureZombiHats:getWidth() / 64 do
	table.insert(zombiHatsRegions,
		TextureRegion.new(textureZombiHats, (i - 1) * 64, 0, 64, 46))
end

zombiCryEndingRegions = {}
table.insert(zombiCryEndingRegions, zombiCryingRegions[3])
table.insert(zombiCryEndingRegions, zombiCryingRegions[2])
table.insert(zombiCryEndingRegions, zombiCryingRegions[1])

bombRegion1 = TextureRegion.new(textureBomb, 0, 0, 64, 64)
bombRegion2 = TextureRegion.new(textureBomb, 64, 0, 64, 64)
bombRegions = {
    bombRegion1, bombRegion2
}
bombRegionLight = TextureRegion.new(textureBomb, 128, 0, 64, 64)

sparkleRegions = {
	TextureRegion.new(textureBomb, 192, 0, 32, 32),
	TextureRegion.new(textureBomb, 224, 0, 32, 32)
}

smokeRegions = {}
for i = 0,13 do
    table.insert(smokeRegions,
		TextureRegion.new(textureSmoke, i * 64, 0, 64, 58))
end

explosionRegions = {}
for i=0,2 do
    table.insert(explosionRegions,
		TextureRegion.new(textureExplosion, i * 160, 0, 160, 160))
end


starRegions = {
	TextureRegion.new(textureStar, 0, 0, textureStar:getWidth(), textureStar:getHeight())
}

captionMainRegion = TextureRegion.new(textureCaption, 0, 0, 120, 94)
captionTailRegion = TextureRegion.new(textureCaption, 64, 96, 56, 28)

-- ground
groundTextures = { textureDirt, textureRock, textureScales, textureStones, }

-- background
backgroundTextures = { school0, school1, school2, school3, school4 }


-- player
rena = BitmapBody.new(standingRegions[1])
rena:setAnchorPoint(0.5, 0.66)
rena:setScale(2, 2)
renaHeight = rena:getHeight()
rena.shape = b2.PolygonShape.new()
rena.shape:setAsBox(15, 5, 0, 0, 0)

-- Arrow parts
from = Bitmap.new(textureFrom)
from:setAnchorPoint(0.5,0.5)
from:setBlendMode(Sprite.ADD)

bar = Bitmap.new(textureBar)
bar:setAnchorPoint(0.5,0.5)
bar:setBlendMode(Sprite.ADD)

arrow = Bitmap.new(textureArrow)
arrow:setAnchorPoint(0.5,0.5)
arrow:setBlendMode(Sprite.ADD)


-- Intro elements
txtRecord = nil

listB = BitmapBody.new(textureList)
listB:setAnchorPoint(0.2, 0.5)
--listB:setAlpha(0.7)
listB:setPosition(stageW - listB:getWidth(),
					stageH - 1.2 * listB:getHeight())
listB.floating = true


runModeB = BitmapBody.new(textureButton0) --textureButton
runModeB:setAnchorPoint(0.5, 0.39)
runModeB:setPosition(45, stageH  - 1 * runModeB:getHeight())
runModeStateTxt = TextField.new(font1, "   ??")
runModeB:addChild(runModeStateTxt)
runModeStateTxt:setPosition(-24, 3 * runModeStateTxt:getHeight())
runModeStateTxt:setTextColor(0xdd20aa55)
runModeB.floating = true


trophyB = BitmapBody.new(textureTrophy)
trophyB:setAnchorPoint(0.7, 0.5)
--trophyB:setAlpha(0.7)
trophyB:setScale(0.2)
trophyB:setPosition(stageW - 0.6 * trophyB:getWidth(),
					0.6 * trophyB:getHeight())
trophyB.floating = true

-- list of fires
pendingFires = {}

-- sounds

sounds = {}
soundSlots = {}
noSound = {
	stop = function() end,
	setPaused = function() end,
	setVolume = function() end,
	setPitch = function() end,
	setLooping = function() end,
	setPosition = function() end,
	isPlaying = function() return nil end,
	isLooping = function() return nil end,
	isPaused = function() return nil end,
}

timerPitch = 1

function sound(s, existing, looping, paused)
	existing = existing ~= nil and existing
	if s == 'music' or s == 'arpegio' then s = s .. '.mp3' else s = s .. '.wav' end
	local ss = soundSlots[s]
	if ss ~= nil then
		if ss:isPaused() or ss:isPlaying() then
			if existing then
				-- print('sound exists', s);
				-- ss:setLooping(looping)
				return ss
			end
			
			-- print('stop sound', s);
			ss:setPaused(true)
			if ss:isPaused() and false then -- FIXME
				ss:setPosition(0)
				ss:setLooping(looping and true)
				ss:setPaused(paused and true)
				return ss
			end
		end
		ss:setPaused(true)
		ss:stop()
	end
	
	if existing then
		return noSound
	end
	
	local o = sounds[s]
	if o == nil then
		o = Sound.new(s)
		sounds[s] = o
	end
	-- print('new sound', s, looping, paused);

	ss = o:play(0, looping, paused)
	soundSlots[s] = ss
	-- ss:addEventListener(Event.COMPLETE, function() 
	 -- soundSlots[s] = nil
	-- end)
	return ss
end

function resetSounds()
	-- print('reset buggy sounds')
	for s, ss in pairs(soundSlots) do
		if s ~= 'music.mp3' or exiting then
			-- print('stop ', s)
			ss:stop()
		end
	end
	local m = 'music.mp3'
	local mm = soundSlots[m]
	soundSlots = {}
	soundSlots[m] = mm
	-- print('reset done')
end

rh = 0

local path = "|D|renabomb.json"
save = {}
local file = io.open(path, "r")
require('json')
if file then
   local contents = file:read("*a")
   io.close(file)
    -- print(contents)
	save = json.decode(contents)
end

local stupidCrc = function(s)
  local crc = 3037454
  local i
  for i = 1, #s do
    local b = s:byte(i)
    crc = bit.bxor(b + b * 256, crc)
	crc = crc * 64 + crc * 4
  end
  return bit.band(bit.bxor(crc, 1070750871), 0x7FFFFFFF)
end

if save.rh ~= nil and save.sh ~= nil then
   -- old format
    if not (bit.bxor(save.rh, 1070750871) == save.record 
        and bit.bxor(save.sh, 1070750871) == save.score) then
		save = {}
	end
else
   -- new format
    if save.h == stupidCrc(json.encode(save.c)) then
		save = save.c
	else
		save = {}
	end
end
score = save.score or 0
record = save.record or 0
runModeRecord = save.runModeRecord or 0
totalRetry = save.totalRetry or 333
retryCounter = save.retryCounter or 333
remainingTime = save.remainingTime or 0
prolongation = save.prolongation or 0
trophies = save.trophies or {}
achievements = save.achievements or {}
game.iLevel = save.iLevel or 0
runMode = save.runMode or false
soundMode = save.soundMode or 0

lastScore = score
lastTrophies = trophies
lastRemainingTime = remainingTime
-- print('soundMode', soundMode)
soundOn = soundMode == 0 or soundMode == 1
musicOn = soundMode == 0
maxLevel = save.maxLevel or save.iLevel or 1
-- print("runMode", runMode)

function saveMe()
	if (save.stamp == nil) then 
		save.stamp = (os.clock() * 567891 + os.date():gsub('[^0-9]', '') + math.random(1, 444444444)) % 1070750871
		print(save.stamp)
	end
	save.record = record
	save.achievements = achievements -- todo checksum
	save.runModeRecord = runModeRecord
	save.remainingTime = remainingTime
	save.prolongation = prolongation
	save.score = ((game.state == state.success) and score
					or (game.state == state.ingame or game.state == state.tuto) and lastScore
					or 0)
	save.totalRetry = totalRetry
	save.retryCounter = retryCounter
	save.trophies = ((game.state == state.success) and trophies
					or (game.state == state.ingame or game.state == state.tuto) and lastTrophies
					or {})
	save.iLevel = game.iLevel
	save.state = ((game.state == state.success) and "success" 
					or (game.state == state.ingame or game.state == state.tuto) and "ingame"
					or "intro")
	save.soundMode = soundMode
	save.runMode = runMode
	save.maxLevel = maxLevel
	local j = json.encode({
		h=stupidCrc(json.encode(json.decode(json.encode(save)))),
		c=save
	})
	local file = io.open( path, "w" )
	if file then
		file:write(j)
		io.close(file)
	end
end
local applicationExitFn = function()
	saveMe()
	resetSounds()
	sound('music', true):stop()
	--collectgarbage(collect)
end

stage:addEventListener(Event.APPLICATION_EXIT, applicationExitFn)
-- stage:addEventListener(Event.APPLICATION_SUSPEND, applicationExitFn)
-- stage:addEventListener(Event.APPLICATION_BACKGROUND, applicationExitFn)

names = {}
