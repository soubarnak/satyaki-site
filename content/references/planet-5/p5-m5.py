route = [3, 2, 1]
turns = [0, 1, 0]
route[2] = 3
for i in range(3):
    if turns[i] == 1:
        turn_left()
    for n in range(route[i]):
        move()
