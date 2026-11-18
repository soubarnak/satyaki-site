route = [2, 1]
turns = [0, 1]
route[1] = 3
for i in range(2):
    if turns[i] == 1:
        turn_left()
    for n in range(route[i]):
        move()
