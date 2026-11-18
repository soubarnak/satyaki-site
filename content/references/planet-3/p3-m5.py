if is_shield_on() == False and energy() > 10:
    shield()
for cell in range(7):
    if distance_ahead() == 0:
        turn_right()
    else:
        move()
