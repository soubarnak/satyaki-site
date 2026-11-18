public class Main {
    public static void main(String[] args) {
        if (isShieldOn() == false && energy() > 10) {
            shield();
        }
        for (int cell = 0; cell < 7; cell++) {
            if (distanceAhead() == 0) {
                turnRight();
            } else {
                move();
            }
        }
    }
}
